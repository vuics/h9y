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
const stripe = Stripe(conf.stripe.secretKey, {
  apiVersion: '2024-09-30.acacia',    // developed with

  // apiVersion: '2024-06-20',        // stable
  // apiVersion: '2025-03-31.basil',  // listed
  // apiVersion: '2025-05-28.basil',  // TODO: upgrade to the newest version (unlisted)

  appInfo: {
    name: "hyag",
    version: "0.0.1",
    url: conf.webApp.origin,
  }
})

app.get('/config', async (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

app.get('/prices', async (req, res) => {

  // TODO:
  //
  // https://docs.stripe.com/get-started/development-environment?lang=node#test-install
  //
  // stripe.products.create({
  //   name: 'Starter Subscription',
  //   description: '$12/Month subscription',
  // }).then(product => {
  //   stripe.prices.create({
  //     unit_amount: 1200,
  //     currency: 'usd',
  //     recurring: {
  //       interval: 'month',
  //     },
  //     product: product.id,
  //   }).then(price => {
  //     console.log('Success! Here is your starter subscription product id: ' + product.id);
  //     console.log('Success! Here is your starter subscription price id: ' + price.id);
  //   });
  // });

  const prices = await stripe.prices.list({
    lookup_keys: ['sample_basic', 'sample_premium'],
    expand: ['data.product']
  });
  res.send({
    prices: prices.data,
  });
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
    });
    verbose('subscription:', subscription)

    res.send({
      subscription,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    return res.status(400).send({ result: 'error', message: error.message });
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
    return res.status(400).send({ result: 'error', message: error.message });
  }
});

app.post('/webhook', raw({ type: 'application/json' }), async (req, res) => {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.header('Stripe-Signature'),
        // process.env.STRIPE_WEBHOOK_SECRET
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
      // Unexpected event type
    }
    res.sendStatus(200);
  }
);

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

///////////////////////////////////////////////////////////////////////////////

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
//     return res.status(400).send({ error: { message: error.message } });
//   }
// });

///////////////////////////////////////////////////////////////////////////////

//app.get('/sessions/active', checkAuth, async (req, res) => {
//  try {
//    // Get all sessions for this user
//    let sessions = await stripe.checkout.sessions.list({
//      limit: 1000000,
//      customer_details: {
//        // NOTE: Do not allow any user to change email because sessions are
//        //       associated with email
//        email: req.user.email,
//      },
//    })
//    // console.log('sessions:', sessions)
//    sessions = sessions.data

//    // Get all subscriptions of all users
//    let subscriptions = await stripe.subscriptions.list({
//      limit: 1000000,
//    })
//    subscriptions = subscriptions.data

//    const existingSubscriptionIds = [...new Set(subscriptions.map(({ id }) => id ))].filter(n => n)
//    // console.log('existingSubscriptionIds:', existingSubscriptionIds)

//    sessions = sessions.filter(sess => {
//      return existingSubscriptionIds.includes(sess.subscription)
//    })

//    res.json(sessions)
//  } catch (err) {
//    console.error('List subscriptions error:', err)
//    res.status(500).json({
//      result: 'error',
//      error: err,
//    })
//  }
//})

//app.post('/session/create', checkAuth, async (req, res) => {
//  try {
//    const prices = await stripe.prices.list({
//      lookup_keys: [req.body.lookup_key],
//      expand: ['data.product'],
//    })
//    console.log('prices:', prices)
//    const session = await stripe.checkout.sessions.create({
//      billing_address_collection: 'auto',
//      line_items: [
//        {
//          price: prices.data[0].id,
//          // For metered billing, do not pass quantity
//          quantity: 1,

//        },
//      ],
//      mode: 'subscription',
//      customer_email: req.user.email,

//      client_reference_id: req.user._id.toString(),
//      metadata: {
//        userId: req.user._id.toString(),
//        firstName: req.user.firstName,
//        lastName: req.user.lastName,
//        email: req.user.email,
//        phone: req.user.phone,
//      },

//      // TODO: Add trials
//      // subscription_data: {
//      //   trial_period_days: 7,
//      // },

//      // TODO: do we need to set the subscription billing cycle date?
//      // subscription_data: {
//      //   billing_cycle_anchor: 1672531200,
//      // },

//      // TODO: do we need to automate the tax collection?
//      automatic_tax: { enabled: true },

//      success_url: `${conf.webApp.origin}/subscription`, // ?success=true&session_id={CHECKOUT_SESSION_ID}`,
//      cancel_url: `${conf.webApp.origin}/subscription`, // ?canceled=true`,
//    })
//    console.log('session:', session)

//    const subs = new Subscription()
//    subs.userId = req.user._id
//    subs.session = session
//    await subs.save()

//    res.redirect(303, session.url)
//  } catch (err) {
//    console.error('Create session error:', err)
//    res.status(500).json({
//      result: 'error',
//      error: err,
//    })
//  }
//})

//app.post('/session/manage', checkAuth, async (req, res) => {
//  try {
//    const { session_id } = req.body
//    const checkoutSession = await stripe.checkout.sessions.retrieve(session_id)
//    const portalSession = await stripe.billingPortal.sessions.create({
//      customer: checkoutSession.customer,
//      return_url: `${conf.webApp.origin}/subscription`,
//    })
//    console.log('portalSession:', portalSession)
//    res.redirect(303, portalSession.url)
//  } catch (err) {
//    console.error('Portal session error:', err)
//    res.status(500).json({
//      result: 'error',
//      error: err,
//    })
//  }
//})

//// TODO: Use webhook:
////   https://api.selfdev.vuics.com/v1/subscriptions/webhook
////
//app.post('/webhook', raw({ type: 'application/json' }), (request, response) => {
//    let event = request.body
//    // Replace this endpoint secret with your endpoint's unique secret
//    // If you are testing with the CLI, find the secret by running 'stripe listen'
//    // If you are using an endpoint defined with the API or dashboard, look in your webhook settings
//    // at https://dashboard.stripe.com/webhooks
//    // const endpointSecret = 'whsec_12345'
//    // Only verify the event if you have an endpoint secret defined.
//    // Otherwise use the basic event deserialized with JSON.parse
//    if (conf.stripe.endpointSecret) {
//      // Get the signature sent by Stripe
//      const signature = request.headers['stripe-signature']
//      try {
//        event = stripe.webhooks.constructEvent(
//          request.body,
//          signature,
//          conf.stripe.endpointSecret
//        )
//      } catch (err) {
//        console.log(`⚠️  Webhook signature verification failed.`, err.message)
//        return response.sendStatus(400)
//      }
//    }
//    let subscription
//    let status
//    // Handle the event
//    switch (event.type) {
//      // FIXME:
//        // what events?
//        //
//        //
//      // case 'customer.subscription.trial_will_end':
//      //   subscription = event.data.object
//      //   status = subscription.status
//      //   console.log(`Subscription status is ${status}.`)
//      //   // Then define and call a method to handle the subscription trial ending.
//      //   // handleSubscriptionTrialEnding(subscription)
//      //   break
//      // case 'customer.subscription.deleted':
//      //   subscription = event.data.object
//      //   status = subscription.status
//      //   console.log(`Subscription status is ${status}.`)
//      //   // Then define and call a method to handle the subscription deleted.
//      //   // handleSubscriptionDeleted(subscriptionDeleted)
//      //   break
//      // case 'customer.subscription.created':
//      //   subscription = event.data.object
//      //   status = subscription.status
//      //   console.log(`Subscription status is ${status}.`)
//      //   // Then define and call a method to handle the subscription created.
//      //   // handleSubscriptionCreated(subscription)
//      //   break
//      // case 'customer.subscription.updated':
//      //   subscription = event.data.object
//      //   status = subscription.status
//      //   console.log(`Subscription status is ${status}.`)
//      //   // Then define and call a method to handle the subscription update.
//      //   // handleSubscriptionUpdated(subscription)
//      //   break
//      default:
//        // Unexpected event type
//        console.log(`Unhandled event type ${event.type}.`)
//    }
//    // Return a 200 response to acknowledge receipt of the event
//    response.send()
//  }
//)

export default app
