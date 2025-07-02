import { Router, raw } from 'express'
import Stripe from 'stripe'

import conf from '../conf.js'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose } from '../services.js'
import Subscription from '../models/subscription.js'

const verbose = Verbose('sd:routes/subscriptions'); verbose('')
const app = Router()

// See Stripe API versions:
//   https://github.com/stripe/stripe-node/wiki
//
//   apiVersion: '2024-06-20',        // stable
//   apiVersion: '2025-03-31.basil',  // listed
//   apiVersion: '2025-05-28.basil',  // TODO: upgrade to the newest version (unlisted)
//
const stripe = Stripe(conf.stripe.secretKey, {
  apiVersion: '2024-09-30.acacia',    // developed with this version
  appInfo: {
    name: "hyag",
    version: "1.0.0",
    url: conf.webApp.origin,
  }
})

app.get('/config', async (req, res) => {
  try {
    res.send({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    return res.status(500).send({ result: 'error', message: err.toString() });
  }
});

app.get('/prices', async (req, res) => {
  try {
    const lookup_keys = ['basic', 'premium']

    let prices = null
    let product = null
    let price = null
    let update_prices = false

    prices = await stripe.prices.list({
      lookup_keys,
      expand: ['data.product'],
      limit: 100,
    });
    verbose('original prices:', prices)
    const found_keys = prices?.data?.map(p => p.lookup_key) || []
    verbose('found_keys:', found_keys)

    // Create products and prices
    //
    //   https://docs.stripe.com/api/products/create
    //   https://docs.stripe.com/api/prices/create
    //
    if (!found_keys.includes("basic")) {
      update_prices = true
      product = await stripe.products.create({
        name: 'Basic',
      });
      verbose('Starter subscription product:', product);
      verbose('Starter subscription product.id:', product.id);
      price = await stripe.prices.create({
        lookup_key: "basic",
        unit_amount: 699,
        currency: 'usd',
        recurring: { interval: 'month', },
        product: product.id,
      })
      verbose('Starter subscription price:', price);
      verbose('Starter subscription price.id:', price.id);
    }

    if (!found_keys.includes("premium")) {
      update_prices = true
      product = await stripe.products.create({
        name: 'Premium',
      });
      verbose('Starter subscription product:', product);
      verbose('Starter subscription product.id:', product.id);
      price = await stripe.prices.create({
        lookup_key: "premium",
        unit_amount: 1999,
        currency: 'usd',
        recurring: { interval: 'month', },
        product: product.id,
      })
      verbose('Starter subscription price:', price);
      verbose('Starter subscription price.id:', price.id);
    }

    if (update_prices) {
      prices = await stripe.prices.list({
        lookup_keys,
        expand: ['data.product'],
        limit: 100,
      });
      verbose('updated prices:', prices)
    }
    res.send({
      prices: prices.data,
    });
  } catch (err) {
    return res.status(500).send({ result: 'error', message: err.message });
  }
});

app.get('/', checkAuth, async (req, res) => {
  let subscriptions = []
  if (req.user.stripe.customerId) {
    subscriptions = await stripe.subscriptions.list({
      customer: req.user.stripe.customerId,
      status: 'all',
      expand: ['data.default_payment_method'],
    });
  }
  res.json({ subscriptions });
});

app.post('/create', checkAuth, async (req, res) => {
  verbose('create subscription body:', req.body)

  try {
    const { priceId } = req.body;
    verbose('priceId:', priceId)

    verbose('req.user:', req.user)
    verbose('req.user.email:', req.user.email)

    if (!req.user.stripe) {
      req.user.stripe = {
        customerId: '',
      };
    }

    if (!req.user.stripe.customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: `${req.user.firstName} ${req.user.lastName}`,
        phone: req.user.phone,
        metadata: {
          userId: req.user._id.toString(),
          firstName: req.user.firstName,
          lastName: req.user.lastName,
        },
      });
      verbose('customer:', customer)
      req.user.stripe.customerId = customer.id
      verbose('customerId:', req.user.stripe.customerId)
    }
    await req.user.save();
    verbose('Saved stripe customer to user document:', req.user);

    const subscription = await stripe.subscriptions.create({
      customer: req.user.stripe.customerId,
      items: [{
        price: priceId,
      }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],

      // TODO: trial period:
      //   https://docs.stripe.com/billing/subscriptions/trials
      //   https://docs.stripe.com/api/subscriptions/create#create_subscription-trial_period_days
      //
      // trial_period_days: 7,
      // // trial_end: timestamp,

      // TODO: do we need to automate the tax collection?
      //
      // Enabling gives an error:
      // >  The customer's location isn't recognized.
      // >  Set a valid customer address in order to automatically calculate tax.
      //
      // automatic_tax: { enabled: true },
    });
    verbose('subscription:', subscription)

    res.send({
      subscription,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    return res.status(400).send({ result: 'error', message: err.toString() });
  }
});

app.post('/cancel', checkAuth, async (req, res) => {
  try {
    verbose('cancel-subscription req.body:', req.body)
    const { subscriptionId } = req.body
    verbose('cancel-subscription subscriptionId:', subscriptionId)
    const canceledSubscription = await stripe.subscriptions.cancel(
      subscriptionId
    );
    verbose('canceledSubscription:', canceledSubscription)

    res.send({ canceledSubscription });
  } catch (error) {
    return res.status(400).send({ result: 'error', message: err.toString() });
  }
});

// NOTE: unused
//
app.post('/invoice/preview', checkAuth, async (req, res) => {
  verbose('req.body:', req.body)
  verbose('req.user:', req.user)
  verbose('req.user.stripe.customerId:', req.user.stripe.customerId)
  const { subscriptionId } = req.body;
  let invoice = {}
  if (req.user.stripe.customerId) {
    invoice = await stripe.invoices.createPreview({
      customer: req.user.stripe.customerId,
      subscription: subscriptionId,
    });
    verbose('invoice:', invoice)
  }
  res.send({ invoice });
});

// TODO: do we need this code?
//
// app.post('/update-subscription', checkAuth, async (req, res) => {
//   try {
//     const subscription = await stripe.subscriptions.retrieve(
//       req.body.subscriptionId
//     );
//     const updatedSubscription = await stripe.subscriptions.update(
//       req.body.subscriptionId, {
//         items: [{
//           id: subscription.items.data[0].id,
//           price: process.env[req.body.newPriceLookupKey.toUpperCase()],
//         }],
//       }
//     );
//     res.send({ subscription: updatedSubscription });
//   } catch (error) {
//     return res.status(400).send({ error: { message: err.toString() } });
//   }
// });

// Use webhook:
//   https://hyag.org/v1/subscriptions/webhook
//
export async function subscriptionsWebhook (req, res) {
  // Retrieve the event by verifying the signature using the raw body and secret.
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.header('Stripe-Signature'),
      conf.stripe.webhookSecret,
    );
  } catch (err) {
    console.log(err);
    console.log(`⚠️  Webhook signature verification failed.`);
    console.log(
      `⚠️  Check the env file and enter the correct webhook secret.`
    );
    return res.sendStatus(400);
  }

  // Print out the event to the console
  console.log(`Received webhook event ${event.type} ${event.id}`);

  // Extract the object from the event.
  const dataObject = event.data.object;

  // Handle the event
  // Review important events for Billing webhooks
  // https://stripe.com/docs/billing/webhooks
  // Remove comment to see the various objects sent for this sample
  switch (event.type) {
    case 'invoice.payment_succeeded':
      if(dataObject['billing_reason'] == 'subscription_create') {
        // The subscription automatically activates after successful payment
        // Set the payment method used to pay the first invoice
        // as the default payment method for that subscription
        const subscription_id = dataObject['subscription']
        const payment_intent_id = dataObject['payment_intent']

        // Retrieve the payment intent used to pay the subscription
        const payment_intent = await stripe.paymentIntents.retrieve(payment_intent_id);
        try {
          const subscription = await stripe.subscriptions.update(subscription_id, {
            default_payment_method: payment_intent.payment_method,
          });
          console.log("Default payment method set for subscription:" + payment_intent.payment_method);
        } catch (err) {
          console.log(err);
          console.log(`⚠️  Failed to update the default payment method for subscription: ${subscription_id}`);
        }
      };

      break;
    case 'invoice.payment_failed':
      // If the payment fails or the customer does not have a valid payment method,
      //  an invoice.payment_failed event is sent, the subscription becomes past_due.
      // Use this webhook to notify your user that their payment has
      // failed and to retrieve new card details.
      break;
    case 'invoice.finalized':
      // If you want to manually send out invoices to your customers
      // or store them locally to reference to avoid hitting Stripe rate limits.
      break;
    case 'customer.subscription.deleted':
      if (event.request != null) {
        // handle a subscription cancelled by your request
        // from above.
      } else {
        // handle subscription cancelled automatically based
        // upon your subscription settings.
      }
      break;
    case 'customer.subscription.trial_will_end':
      // Send notification to your user that the trial will end
      break;
    default:
      console.log(`Unhandled event type ${event.type}.`)
  }
  res.sendStatus(200);
}

///////////////////////////////////////////////////////////////////////////////
// Metered Usage

app.post('/create-customer', async (req, res) => {
  try {
    const customer = await stripe.customers.create({
      name: req.body.name,
      email: req.body.email,
    });
    res.send({ customer });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

app.post('/create-meter', async (req, res) => {
  try {
    const meter = await stripe.billing.meters.create({
      display_name: req.body.displayName,
      event_name: req.body.eventName,
      default_aggregation: {
        formula: req.body.aggregationFormula,
      },
    });
    res.send({ meter });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

const createMeterEvent = async (req, res) => {
  try {
    const meterEvent = await stripe.v2.billing.meterEvents.create({
      event_name: req.body.eventName,
      payload: {
        value: req.body.value + '',
        stripe_customer_id: req.body.customerId,
      },
    });
    res.send({ meterEvent });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
}
app.post('/create-meter-event', createMeterEvent);
// app.post('/api/create-meter-event', createMeterEvent);

app.post('/create-price', async (req, res) => {
  try {
    const price = await stripe.prices.create({
      currency: req.body.currency,
      unit_amount: req.body.amount,
      recurring: {
        interval: 'month',
        meter: req.body.meterId,
        usage_type: 'metered',
      },
      product_data: {
        name: req.body.productName,
      },
    });
    res.send({ price });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

const createSubscription = async (req, res) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: req.body.customerId,
      items: [{ price: req.body.priceId }],
      expand: ['pending_setup_intent'],
    });
    res.send({ subscription });
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
}
app.post('/create-subscription', createSubscription);
// app.post('/api/create-subscription', createSubscription);

//
///////////////////////////////////////////////////////////////////////////////

export default app
