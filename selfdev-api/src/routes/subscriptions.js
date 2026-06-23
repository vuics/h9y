import { Router, raw } from 'express'
import Stripe from 'stripe'
import { inspect } from 'util'
import lodash from 'lodash'
const { isEmpty } = lodash

import conf from '../conf.js'
import { checkAuth, checkAPIAuth, checkAdmin } from '../middleware/check-auth.js'
import { Verbose, error } from '../services.js'
import User from '../models/user.js'
import { getUserPlanFromYookassa } from './autopayments.js'

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

export const checkStripe = (req, res, next) => {
  if (conf.stripe.enable) {
    next()
  } else {
    res.status(403).json({
      result: 'error',
      message: 'The Stripe integration is disabled'
    })
  }
}

app.get('/admin-init', checkAuth, checkAdmin, checkStripe, async (req, res) => {
  try {
    const products = await stripe.products.list({
      active: true,
      limit: 100,
    })
    verbose('products:', products)

    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
    });
    verbose('prices:', prices)
    const found_keys = prices?.data?.map(p => p.lookup_key) || []
    verbose('found_keys:', found_keys)

    // Create products, prices, meters:
    //   https://docs.stripe.com/api/products/create
    //   https://docs.stripe.com/api/prices/create
    //   https://docs.stripe.com/api/billing/meter
    //
    for (const plan of Object.keys(conf.plans)) {
      verbose('process plan:', plan)

      if (!isEmpty(conf.plans[plan]?.product)) {
        verbose('Looking to plan:', plan);
        // update_prices = true
        let product = null
        product = products.data.find(pd => pd.name === conf.plans[plan].product.name)
        verbose('found product:', product)
        if (!product) {
          verbose('Product does not exists. Creating:', conf.plans[plan].product);
          product = await stripe.products.create(
            conf.plans[plan].product
          );
          verbose('Created subscription product:', product);
        }

        for (const priceObj of conf.plans[plan].prices) {
          if (!found_keys.includes(priceObj.lookup_key)) {
            const { meter: extractedMeter, ...recurringWithoutMeter } = priceObj.recurring || {};
            let meter = null
            if (!isEmpty(extractedMeter)) {
              verbose('create-meter')
              const meters = await stripe.billing.meters.list({
                status: 'active',
                limit: 100,
              });
              verbose('active meters:', meters)

              const eventNames = meters.data.map(m => m.event_name) || []
              verbose('eventNames:', eventNames)
              if (eventNames.includes(extractedMeter.event_name)) {
                meter = meters?.data.find(m => m.event_name === extractedMeter.event_name)
              } else {
                verbose(`Meter ${extractedMeter.event_name} does not exist, creating.`)
                meter = await stripe.billing.meters.create(extractedMeter);
                verbose('Created a meter:', meter);
              }
              verbose('meter:', meter)
            }
            const { recurring, ...priceRest } = priceObj;
            const price = await stripe.prices.create({
              ...priceRest,
              recurring: {
                meter: meter?.id || undefined,
                ...recurringWithoutMeter
              },
              product: product.id,
            })
            verbose('Create subscription price:', price);
          }
        }
      }
    }

    const updatedProducts = await stripe.products.list({
      active: true,
      limit: 100,
    })
    const updatedPrices = await stripe.prices.list({
      active: true,
      limit: 100,
    });
    const updatedMeters = await stripe.billing.meters.list({
      status: 'active',
      limit: 100,
    });
    res.send({
      products: updatedProducts,
      prices: updatedPrices,
      meters: updatedMeters,
    });
  } catch (err) {
    return res.status(400).send({ result: 'error', message: err.toString() });
  }
});

app.get('/config', checkAuth, checkStripe, async (req, res) => {
  try {
    res.send({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    return res.status(400).send({ result: 'error', message: err.toString() });
  }
});

app.get('/', checkAuth, checkStripe, async (req, res) => {
  let subscriptions = []
  if (req.user.stripe.customerId) {
    subscriptions = await stripe.subscriptions.list({
      customer: req.user.stripe.customerId,
      // status: 'all',
      status: 'active',
      expand: ['data.default_payment_method'],
      limit: 100,
    });
  }
  res.json({ subscriptions });
});

function getCustomerIpAddress ({ req }) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  return ip
}

async function updateCustomer ({ req }) {
  try {

    verbose('req.user:', req.user)
    verbose('req.user.email:', req.user.email)

    if (!req.user.stripe) {
      req.user.stripe = {
        customerId: '',
      };
    }

    const ip_address = getCustomerIpAddress({ req })
    verbose('customer ip_address:', ip_address)

    let customer = null
    const customerData = {
      email: req.user.email,
      name: `${req.user.firstName} ${req.user.lastName}`,
      phone: req.user.phone,
      address: {
        line1: req.user.address.line1,
        line2: req.user.address.line2,
        city: req.user.address.city,
        state: req.user.address.state,
        postal_code: req.user.address.postalCode,
        country: req.user.address.country,
      },
      tax: {
        ip_address,
        validate_location: 'immediately',
      },

      // TODO: add user tax data
      //
      // tax_id_data: {
      //   type: '',  // Type of the tax ID, one of ad_nrt, ae_trn, al_tin, am_tin, ao_tin, ar_cuit, au_abn, au_arn, aw_tin, az_tin, ba_tin, bb_tin, bd_bin, bf_ifu, bg_uic, bh_vat, bj_ifu, bo_tin, br_cnpj, br_cpf, bs_tin, by_tin, ca_bn, ca_gst_hst, ca_pst_bc, ca_pst_mb, ca_pst_sk, ca_qst, cd_nif, ch_uid, ch_vat, cl_tin, cm_niu, cn_tin, co_nit, cr_tin, cv_nif, de_stn, do_rcn, ec_ruc, eg_tin, es_cif, et_tin, eu_oss_vat, eu_vat, gb_vat, ge_vat, gn_nif, hk_br, hr_oib, hu_tin, id_npwp, il_vat, in_gst, is_vat, jp_cn, jp_rn, jp_trn, ke_pin, kg_tin, kh_tin, kr_brn, kz_bin, la_tin, li_uid, li_vat, ma_vat, md_vat, me_pib, mk_vat, mr_nif, mx_rfc, my_frp, my_itn, my_sst, ng_tin, no_vat, no_voec, np_pan, nz_gst, om_vat, pe_ruc, ph_tin, ro_tin, rs_pib, ru_inn, ru_kpp, sa_vat, sg_gst, sg_uen, si_tin, sn_ninea, sr_fin, sv_nit, th_vat, tj_tin, tr_tin, tw_vat, tz_vat, ua_vat, ug_tin, us_ein, uy_ruc, uz_tin, uz_vat, ve_rif, vn_tin, za_vat, zm_tin, or zw_tin
      //   value: '',
      // },
      // tax_exempt: 'none',  // The customer’s tax exemption. One of none, exempt, or reverse.

      metadata: {
        userId: req.user._id.toString(),
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
    }
    verbose('customer data:', customerData)

    if (!req.user.stripe.customerId) {
      verbose('Customer does not exist for user:', req.user.email, '. Creating.')
      customer = await stripe.customers.create(customerData);
      req.user.stripe.customerId = customer.id
      await req.user.save();
      verbose('Saved stripe customer to user document:', req.user);
    } else {
      customer = await stripe.customers.update(
        req.user.stripe.customerId,
        customerData,
      );
    }
    verbose('customer:', customer)
    verbose('customerId:', req.user.stripe.customerId)
  } catch (err) {
    error('Error ensuring customer exists:', err)
    throw err
  }
}

app.post('/create', checkAuth, checkStripe, async (req, res) => {
  verbose('create subscription body:', req.body)

  try {
    const { plan } = req.body;
    verbose('plan:', plan)

    await updateCustomer({ req })

    verbose('plan prices:', conf.plans[plan]?.prices)
    const lookup_keys = conf.plans[plan]?.prices?.map(p => p.lookup_key)
    verbose('lookup_keys:', lookup_keys)
    const prices = await stripe.prices.list({
      lookup_keys,
      active: true,
      limit: 100,
    });
    verbose('got prices:', prices)
    const items = prices.data.map(pd => ({ price: pd.id }))
    verbose('items:', items)

    verbose('subscription config:', conf.plans[plan]?.subscription)

    const subscriptionData = {
      customer: req.user.stripe.customerId,
      items,
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
      automatic_tax: { enabled: true },

      metadata: {
        plan,
      },

      ...(conf.plans[plan]?.subscription),
    }
    verbose('subscriptionData:', subscriptionData)

    const subscription = await stripe.subscriptions.create(subscriptionData);
    verbose('subscription:', subscription)

    res.send({
      subscription,
      clientSecret: subscription?.latest_invoice?.payment_intent?.client_secret,
    });
  } catch (err) {
    error('Error creating subscription:', err)
    return res.status(400).send({ result: 'error', message: err.toString() });
  }
});

app.post('/cancel', checkAuth, checkStripe, async (req, res) => {
  try {
    verbose('cancel-subscription req.body:', req.body)
    const { subscriptionId } = req.body
    verbose('cancel-subscription subscriptionId:', subscriptionId)
    const canceledSubscription = await stripe.subscriptions.cancel(
      subscriptionId
    );
    verbose('canceledSubscription:', canceledSubscription)

    res.send({ canceledSubscription });
  } catch (err) {
    error('Error canceling subscription:', err)
    return res.status(400).send({ result: 'error', message: err.toString() });
  }
});

app.post('/promotion', checkAuth, checkStripe, async (req, res) => {
  try {
    verbose('promotion req.body:', req.body)
    const { subscriptionId, promotionCode } = req.body
    const promos = await stripe.promotionCodes.list({
      code: promotionCode,
      active: true,
      limit: 1,
    });
    verbose('promos:', promos)
    const promotionCodeId = promos.data[0]?.id;
    if (!promotionCodeId) {
      throw new Error('Promotion code is not found')
    }
    verbose('promotionCodeId:', promotionCodeId)

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      discounts: [ {
        promotion_code: promotionCodeId
      }, ],
    });
    verbose('promotion updatedSubscription:', updatedSubscription)
    const invoice = await stripe.invoices.createPreview({
      customer: req.user.stripe.customerId,
      subscription: subscriptionId,
      discounts: [ {
        promotion_code: promotionCodeId
      }, ],
    });
    verbose('promotion invoice:', invoice)
    res.send({ updatedSubscription, invoice, });
  } catch (err) {
    error('Promotion error:', err)
    return res.status(400).send({ result: 'error', message: err.toString() });
  }
});

// NOTE: unused
//
app.post('/invoice/preview', checkAuth, checkStripe, async (req, res) => {
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

// Set webhook to :
//   https://api.h9y.ai/v1/subscriptions/webhook
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
      verbose('invoice.payment_succeeded dataObject:', dataObject)
      if(dataObject['billing_reason'] == 'subscription_create') {
        try {
        // The subscription automatically activates after successful payment
        // Set the payment method used to pay the first invoice
        // as the default payment method for that subscription
        const subscription_id = dataObject['subscription']
        const payment_intent_id = dataObject['payment_intent']
        verbose('subscription_id:', subscription_id)
        verbose('payment_intent_id:', payment_intent_id)

        // Retrieve the payment intent used to pay the subscription
        const payment_intent = await stripe.paymentIntents.retrieve(payment_intent_id);
        verbose('payment_intent:', payment_intent)
          const subscription = await stripe.subscriptions.update(subscription_id, {
            default_payment_method: payment_intent.payment_method,
            // expand: ['data.default_payment_method'],
          });
          verbose('subscription:', inspect(subscription, { depth: null, colors: true }))
          console.log("Default payment method set for subscription:", payment_intent.payment_method);

          const user = await User.findOne({ 'stripe.customerId': payment_intent.customer });
          if (!user) {
            error('User was not found for the customer:', payment_intent.customer);
          } else {
            await updateUserLimits({ user })
          }
        } catch (err) {
          error('Webhook invoice.payment_succeeded error:', err);
          error(`⚠️  Failed to update the default payment method for subscription: ${subscription_id}`);
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
      verbose('customer.subscription.deleted dataObject:', dataObject)
      if (event.request != null) {
        // handle a subscription cancelled by your request
        // from above.
      } else {
        // handle subscription cancelled automatically based
        // upon your subscription settings.
      }

      const user = await User.findOne({ 'stripe.customerId': dataObject.customer });
      if (!user) {
        error('User was not found for the customer:', dataObject.customer);
      } else {
        await updateUserLimits({ user })
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

export async function getUserPlanFromStripe({ user }) {
  try {
    let plan = null
    verbose('conf.stripe.enable:', conf.stripe.enable, ', user.stripe?.customerId:', user.stripe?.customerId)
    if (conf.stripe.enable && user.stripe?.customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe.customerId,
        status: 'active',
      });
      verbose('subscriptions:', inspect(subscriptions, { depth: null, colors: true }))
      // TODO: what to do with other active subscriptions in case there are multiple?
      const subscription = subscriptions.data[0]
      if (subscription) {
        verbose('first subscription:', inspect(subscription, { depth: null, colors: true }))
        plan = subscription?.metadata.plan
      }
    }
    verbose('plan:', plan)
    return plan
  } catch (err) {
    error('Error getting user plan from stripe:', err)
    throw err
  }
}

export async function updateUserLimits ({ user }) {
  try {
    verbose('updateUserLimits user.limits (before):', user.limits, ', limits enabled:', conf.limits.enable)
    if (!conf.limits.enable) {
      verbose('user.limits (before):', user.limits)
      if (user.limits) {
        user.set('limits', undefined);
      }
      verbose('user.limits (after):', user.limits)
    } else {
      let plan = null
      plan = await getUserPlanFromStripe({ user })
      verbose('plan from stripe:', plan)
      if (!plan) {
        plan = getUserPlanFromYookassa({ user })
        verbose('plan from yookassa:', plan)
      }
      if (!plan) {
        plan = 'free'
      }
      verbose('plan:', plan)
      if (plan && conf.plans[plan]) {
        user.limits = conf.plans[plan].limits;
      } else {
        console.error('Unknown plan:', plan, '. Switching to free limits.');
        user.limits = conf.plans.free.limits;
      }
    }
    await user.save()
    verbose('updateUserLimits user.limits (after):', user.limits)
  } catch (err) {
    error('Error updating user limits:', err)
    throw err
  }
}

// export async function updateUserLimits ({ user }) {
//   try {
//     verbose('updateUserLimits user.limits (before):', user.limits, ', limits enabled:', conf.limits.enable)
//     if (!conf.limits.enable) {
//       verbose('user.limits (before):', user.limits)
//       if (user.limits) {
//         user.set('limits', undefined);
//       }
//       verbose('user.limits (after):', user.limits)
//     } else {
//       if (!user.stripe?.customerId) {
//         // verbose('updateUserLimits plans.free.limits:', conf.plans.free.limits)
//         user.limits = conf.plans.free.limits;
//       } else {
//         if (user.stripe.customerId) {
//           const subscriptions = await stripe.subscriptions.list({
//             customer: user.stripe.customerId,
//             status: 'active',
//             // expand: ['data.default_payment_method'],
//           });
//           verbose('subscriptions:', inspect(subscriptions, { depth: null, colors: true }))

//           // TODO: what to do with other active subscriptions in case there are multiple?

//           const subscription = subscriptions.data[0]
//           if (!subscription) {
//             user.limits = conf.plans.free.limits;
//           }
//           verbose('first subscription:', inspect(subscription, { depth: null, colors: true }))

//           // Set user account limits
//           const { plan } = subscription?.metadata
//           verbose('plan:', plan)
//           if (plan && conf.plans[plan]) {
//             user.limits = conf.plans[plan].limits;
//           } else {
//             console.error('Unknown plan:', plan, '. Switching to free limits.');
//             user.limits = conf.plans.free.limits;
//           }
//         }
//       }
//     }
//     await user.save()
//     verbose('updateUserLimits user.limits (after):', user.limits)
//   } catch (err) {
//     error('Error updating user limits:', err)
//     throw err
//   }
// }

///////////////////////////////////////////////////////////////////////////////
// Meter events
//
// app.post('/metered/meter', checkAuth, async (req, res) => {
//   try {
//     verbose('/metered/meter req.body:', req.body)
//     // await updateCustomer({ req })
//
//     const meterEvent = await stripe.v2.billing.meterEvents.create({
//       event_name: 'meter3'
//       payload: {
//         value: '1',
//         stripe_customer_id: req.user.stripe.customerId,
//       },
//     });
//     res.send({ meterEvent });
//   } catch (err) {
//     return res.status(400).send({ result: 'error', message: err.toString() });
//   }
// })

export default app
