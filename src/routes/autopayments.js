import { Router, raw } from 'express'
import { inspect } from 'util'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import lodash from 'lodash'
const { isEmpty } = lodash

import conf from '../conf.js'
import { checkAuth, checkAPIAuth, checkAdmin } from '../middleware/check-auth.js'
import { Verbose, error } from '../services.js'
import User from '../models/user.js'

const verbose = Verbose('sd:routes/autopayments'); verbose('')
const app = Router()

const authString = `${conf.yookassa.shopId}:${conf.yookassa.apiKey}`
const auth = Buffer.from(authString).toString("base64")

// FIXME: DRY
// function getCustomerIpAddress ({ req }) {
//   const forwarded = req.headers['x-forwarded-for'];
//   const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
//   return ip
// }

async function getPayment(paymentId) {
  try {
    const response = await axios.get(
      `https://api.yookassa.ru/v3/payments/${paymentId}`,
      {
        headers: {
          "Authorization": `Basic ${auth}`,
        },
      }
    );
    verbose('getPayment:', response.data);
  } catch (err) {
    error(err.response?.data || err.message);
  }
}

async function usePaymentMethod(paymentMethodId) {
  try {
    const response = await axios.post(
      "https://api.yookassa.ru/v3/payments",
      {
        amount: {
          value: "2.00",
          currency: "RUB",
        },
        capture: true,
        payment_method_id: paymentMethodId,
        description: "Заказ №37",
      },
      {
        headers: {
          "Authorization": `Basic ${auth}`,
          "Idempotence-Key": uuidv4(),
          "Content-Type": "application/json",
        },
      }
    );
    verbose(response.data);
  } catch (err) {
    error(err.response?.data || err.message);
  }
}

// // Example usage:
// usePaymentMethod("306dfbd7-000f-5001-8000-1454d25433c1");

// // Example usage:
// getPayment("306dfbd7-000f-5001-8000-1454d25433c1");

app.get('/', checkAuth, async (req, res) => {
  try {
    res.json({ });
  } catch (err) {
    error('Error ensuring customer exists:', err)
    throw err
  }
});

app.post('/subscribe', checkAuth, async (req, res) => {
  try {
    verbose('subscribe')
    verbose('authString:', authString)
    verbose('auth:', auth)

    const response = await axios.post("https://api.yookassa.ru/v3/payments", {
      amount: {
        value: "1.23",
        currency: "RUB",
      },
      confirmation: {
        "type": "embedded"
      },
      capture: true,
      description: `Test ${uuidv4()}`,
      save_payment_method: true,
    }, {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": uuidv4(),
        "Content-Type": "application/json",
      },
    });
    verbose('savePaymentMethod:', response.data);

    res.json({
      paymentId: response.data.id,
      confirmationToken: response.data.confirmation.confirmation_token,
    });
  } catch (err) {
    error('Error ensuring customer exists:', err.response?.data || err.message || err)
    throw err
  }
});

app.post('/check', checkAuth, async (req, res) => {
  try {
    verbose('check')
    // verbose('authString:', authString)
    // verbose('auth:', auth)
    const { paymentId } = req.body
    const response = await axios.get(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": uuidv4(),
        "Content-Type": "application/json",
      },
    });
    verbose('confirm response.data:', response.data);

    const status = response.data.status
    if (status === 'succeeded') {
      verbose('payment succeeded')
    }

    res.json({
      status,
      // paymentId: response.data.id,
      // confirmationToken: response.data.confirmation.confirmation_token,
    });
  } catch (err) {
    error('Error ensuring customer exists:', err.response?.data || err.message || err)
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

export default app
