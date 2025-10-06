import { Router, raw } from 'express'
import { inspect } from 'util'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import lodash from 'lodash'
const { isEmpty, has } = lodash

import conf from '../conf.js'
import { checkAuth, checkAPIAuth, checkAdmin } from '../middleware/check-auth.js'
import { Verbose, warn, error } from '../services.js'
import User from '../models/user.js'
import { addInterval } from '../utils/datetime.js'
import { updateUserLimits } from './subscriptions.js'

const verbose = Verbose('sd:routes/autopayments'); verbose('')
const app = Router()

const authString = `${conf.yookassa.shopId}:${conf.yookassa.apiKey}`
const auth = Buffer.from(authString).toString("base64")

export const checkYookassa = (req, res, next) => {
  if (conf.yookassa.enable) {
    next()
  } else {
    res.status(403).json({
      result: 'error',
      message: 'The Yookassa integration is disabled'
    })
  }
}

app.get('/', checkAuth, checkYookassa, async (req, res) => {
  try {
    const {
      plan, createdAt, periodStart, periodEnd, active, canceled, canceledAt
    } = req.user.yookassa
    verbose('yookassa includes:', plan, createdAt, periodStart, periodEnd, active, canceled, canceledAt)
    res.json({
      plan, createdAt, periodStart, periodEnd, active, canceled, canceledAt
    });
  } catch (err) {
    error('Error getting subscription:', err)
    throw err
  }
});

app.post('/subscribe', checkAuth, checkYookassa, async (req, res) => {
  try {
    verbose('subscribe')
    verbose('authString:', authString)
    verbose('auth:', auth)
    const { plan } = req.body
    verbose('plan:', plan)

    const planObj = conf.plans[plan]
    verbose('planObj:', planObj)
    if (!planObj || !has(planObj, 'pricesRu')) {
      throw new Error(`Unknown plan: ${plan}, planObj: ${planObj}`)
    }
    verbose('plan prices:', planObj.pricesRu)

    const response = await axios.post("https://api.yookassa.ru/v3/payments", {
      description: planObj.product.name,
      amount: {
        value: planObj.pricesRu.value,
        currency: planObj.pricesRu.currency,
      },
      confirmation: {
        type: conf.yookassa.confirmationRedirect ? "redirect" : "embedded",
        return_url: conf.yookassa.confirmationRedirect ? `${conf.webApp.origin}/subscribe?paymentId=0` : undefined, // where the user comes back after 3DS
      },
      capture: true,
      save_payment_method: true,
    }, {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": uuidv4(),
        "Content-Type": "application/json",
      },
    });
    verbose('subscribe response.data:', response.data);

    req.user.yookassa.pending = {
      plan,
      paymentId: response.data.id,
      confirmationUrl: response.data.confirmation.confirmation_url,
    }
    await req.user.save();
    verbose('Saved yookassa data to user document:', req.user);

    res.json({
      paymentId: response.data.id,

      // FIXME: which one to choose?
      confirmationToken: response.data.confirmation.confirmation_token,
      confirmationUrl: response.data.confirmation.confirmation_url,
    });
  } catch (err) {
    error('Error subscribing:', err.response?.data || err.message || err)
    throw err
  }
});

async function activateYookassaPlan({ user, paymentData, autopayment }) {
  const planObj = conf.plans[user.yookassa.pending.plan]
  user.yookassa.plan = user.yookassa.pending.plan
  user.yookassa.paymentIds.push(paymentData.id)
  if (autopayment) {
    user.yookassa.periodStart = user.yookassa.periodEnd
  } else {
    user.yookassa.paymentMethodIds.push(paymentData.payment_method.id)
    user.yookassa.createdAt = paymentData.captured_at
    user.yookassa.periodStart = paymentData.captured_at
  }
  user.yookassa.periodEnd = addInterval(
    new Date(user.yookassa.periodStart),
    planObj.pricesRu.interval,
    planObj.pricesRu.number,
  )
  user.yookassa.active = true
  user.yookassa.canceled = false
  user.yookassa.canceledAt = undefined
  user.yookassa.cancelationReason = undefined
  user.yookassa.pending = undefined
  await user.save();
  verbose('Updated yookassa data in user document:', user);
  await updateUserLimits({ user })
}

async function cancelYookassaPlan({ user, cancelationReason }) {
  user.yookassa.active = false
  user.yookassa.canceled = true
  const now = new Date();
  user.yookassa.canceledAt = now
  user.yookassa.cancelationReason = cancelationReason
  user.yookassa.pending = undefined
  await user.save();
  verbose('Updated yookassa data in user document:', user);
  await updateUserLimits({ user })
}

export async function handlePaymentStatus({ user, paymentData, autopayment }) {
  if (paymentData.status === 'succeeded') {
    verbose('Payment succeeded')
    await activateYookassaPlan({ user, paymentData, autopayment })
  } else if (paymentData.status === 'pending') {
    verbose('Payment is still pending. Checking pending expiration.')
    const pendingExpiresAt = addInterval(
      new Date(user.yookassa.periodEnd),
      conf.yookassa.pendingExpiration.interval,
      conf.yookassa.pendingExpiration.number,
    )
    const now = new Date();
    if (now > pendingExpiresAt) {
      verbose('Pending autopayment is expired.')
      await cancelYookassaPlan({
        user,
        cancelationReason: 'Pending autopayment expired',
      })
      // TODO: send email that we have canceled the Yookassa plan
    }
  } else {                         // e.g., paymentData.status === 'canceled'
    warn('payment id:', paymentId, 'has status:', paymentData.status)
    await cancelYookassaPlan({
      user,
      cancelationReason: 'Payment failed',
    })
  }
}

app.post('/check', checkAuth, checkYookassa, async (req, res) => {
  try {
    verbose('check')
    // verbose('authString:', authString)
    // verbose('auth:', auth)

    // const { paymentId } = req.body
    // if (req.body.paymentId === '0') {
    // } else if (paymentId !== req.user.yookassa.pending?.paymentId) {
    //   throw new Error(`Current paymentId: ${paymentId} !== pending paymentId: ${req.user.yookassa.pending?.paymentId}`)
    // }

    const { paymentId } = req.user.yookassa.pending
    // if (!paymentId) {
    //   throw new Error(`User does not have pending paymentId, pending: ${req.user.yookassa.pending}`)
    // }
    const response = await axios.get(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": uuidv4(),
        "Content-Type": "application/json",
      },
    });
    verbose('confirm response.data:', response.data);
    await handlePaymentStatus({
      user: req.user,
      paymentData: response.data,
      autopayment: false
    })

    // const planObj = conf.plans[req.user.yookassa.pending.plan]
    // if (response.data.status === 'succeeded') {
    //   verbose('payment succeeded')
    //   req.user.yookassa.plan = req.user.yookassa.pending.plan
    //   req.user.yookassa.paymentIds.push(paymentId)
    //   req.user.yookassa.paymentMethodIds.push(response.data.payment_method.id)
    //   req.user.yookassa.createdAt = response.data.captured_at
    //   req.user.yookassa.periodStart = response.data.captured_at
    //   req.user.yookassa.periodEnd = addInterval(
    //     new Date(req.user.yookassa.periodStart),
    //     planObj.pricesRu.interval,
    //     planObj.pricesRu.number,
    //   )
    //   req.user.yookassa.active = true
    //   req.user.yookassa.canceled = false
    //   req.user.yookassa.canceledAt = undefined
    // } else {
    //   warn('payment id:', paymentId, 'has status:', response.data.status)
    // }
    // req.user.yookassa.pending = undefined
    // await req.user.save();
    // verbose('Updated yookassa data in user document:', req.user);
    // await updateUserLimits({ user: req.user })

    const {
      plan, createdAt, periodStart, periodEnd, active, canceled, canceledAt
    } = req.user.yookassa
    verbose('yookassa includes:', plan, createdAt, periodStart, periodEnd, active, canceled)
    res.json({
      plan, createdAt, periodStart, periodEnd, active, canceled, canceledAt
    });
  } catch (err) {
    error('Error checking payment:', err.response?.data || err.message || err)
    res.json({
      err,
    });
  }
});

app.delete('/cancel', checkAuth, checkYookassa, async (req, res) => {
  try {
    await cancelYookassaPlan({
      user: req.user,
      cancelationReason: 'Canceled by user',
    })

    const {
      plan, createdAt, periodStart, periodEnd, active, canceled, canceledAt
    } = req.user.yookassa
    verbose('yookassa includes:', plan, createdAt, periodStart, periodEnd, active, canceled)
    res.json({
      plan, createdAt, periodStart, periodEnd, active, canceled, canceledAt
    });
  } catch (err) {
    error('Error canceling subscription:', err)
    throw err
  }
});

// Set webhook to :
//   https://api.hyag.org/v1/subscriptions/webhook
//
// export async function subscriptionsWebhook (req, res) {
//   // Retrieve the event by verifying the signature using the raw body and secret.
//   let event;

//   try {
//   } catch (err) {
//     console.log(err);
//     // console.log(`⚠️  Webhook signature verification failed.`);
//     // console.log(
//     //   `⚠️  Check the env file and enter the correct webhook secret.`
//     // );
//     return res.sendStatus(400);
//   }

//   // Print out the event to the console
//   // console.log(`Received webhook event ${event.type} ${event.id}`);

//   // Extract the object from the event.
//   const dataObject = event.data.object;

//   // Handle the event
//   // Review important events for Billing webhooks
//   // https://stripe.com/docs/billing/webhooks
//   // Remove comment to see the various objects sent for this sample
//   switch (event.type) {

//     case 'invoice.payment_succeeded':
//       verbose('invoice.payment_succeeded dataObject:', dataObject)
//       break;

//     case 'invoice.payment_failed':
//       // If the payment fails or the customer does not have a valid payment method,
//       //  an invoice.payment_failed event is sent, the subscription becomes past_due.
//       // Use this webhook to notify your user that their payment has
//       // failed and to retrieve new card details.
//       break;

//     case 'invoice.finalized':
//       // If you want to manually send out invoices to your customers
//       // or store them locally to reference to avoid hitting Stripe rate limits.
//       break;

//     case 'customer.subscription.deleted':
//       break;

//     case 'customer.subscription.trial_will_end':
//       // Send notification to your user that the trial will end
//       break;

//     default:
//       console.log(`Unhandled event type ${event.type}.`)
//   }
//   res.sendStatus(200);
// }

// ./subscriptions.js imports it to update user plan.
export function getUserPlanFromYookassa({ user }) {
  let plan = null
  verbose('user.yookassa:', user.yookassa)
  verbose('conf.yookassa.enable:', conf.yookassa.enable, ', user.yookassa?.active:', user.yookassa?.active)
  if (conf.yookassa.enable && user.yookassa?.active) {
    verbose('user.yookassa.plan:', user.yookassa.plan)
    plan = user.yookassa.plan
    verbose('plan:', plan)
  }
  return plan
}

export default app
