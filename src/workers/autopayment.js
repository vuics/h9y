import { inspect } from 'util'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { transporter } from '../mailer.js'
import lodash from 'lodash'
const { isEmpty, has } = lodash

import { log, warn, error, Verbose } from '../services.js'
import conf, { revealConf } from '../conf.js'
import { addInterval } from '../utils/datetime.js'
import { userI18n } from '../i18n.js'

// Connect to MongoDB through Mongoose driver
import '../mongo.js'
import User from '../models/user.js'

const verbose = Verbose('sd:workers/autopayment'); verbose('')

log('public conf:', inspect(revealConf(), { colors: true, depth: null }))

// In cron syntax, the fields are:
//
// ┌───────────── minute (0 - 59)
// │ ┌─────────── hour (0 - 23)
// │ │ ┌───────── day of month (1 - 31)
// │ │ │ ┌─────── month (1 - 12)
// │ │ │ │ ┌───── day of week (0 - 7) (0 or 7 = Sunday)
// │ │ │ │ │
// * * * * *

// // Every minute
// cron.schedule("* * * * *", () => {
//   console.log(`[${new Date().toISOString()}] Minute log message`);
// });

// // Every 5 minutes (0, 5, 10, 15, ... 55)
// cron.schedule("*/5 * * * *", () => {
//   console.log(`[${new Date().toISOString()}] Every 5 minutes log message`);
// });

// // Every hour
// cron.schedule("0 * * * *", () => {
//   console.log(`[${new Date().toISOString()}] Hourly log message`);
// });

// // Every day at 12 am
// cron.schedule("0 0 * * *", () => {
//   console.log(`[${new Date().toISOString()}] Daily log message (midnight)`);
// });

// // On the 1st of every month at 12 am
// cron.schedule("0 0 1 * *", () => {
//   console.log(`[${new Date().toISOString()}] Monthly log message (beginning of month)`);
// });

// // On Jan 1st at 12 am (once a year)
// cron.schedule("0 0 1 1 *", () => {
//   console.log(`[${new Date().toISOString()}] Yearly log message (Happy New Year 🎉)`);
// });

// console.log("Scheduler started. Waiting for jobs...");

const authString = `${conf.yookassa.shopId}:${conf.yookassa.apiKey}`
const auth = Buffer.from(authString).toString("base64")

async function renewSubscription({ plan, paymentMethodId }) {
  try {
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
      capture: true,
      payment_method_id: paymentMethodId,
    }, {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": uuidv4(),
        "Content-Type": "application/json",
      },
    });
    log('Subscription renewed:', response.data);
    return {
      status: response.data.status,
      paid: response.data.paid,
      paymentId: response.data.id,
      confirmationUrl: response.data.confirmation?.confirmation_url,
    }
  } catch (err) {
    error('Error renewing subscription:', err.response?.data || err.message);
  }
}

async function handleExpiredSubscription({ user }) {
  try {
    const paymentMethodId = user.yookassa.paymentMethodIds.at(-1)
    const { status, paid, paymentId, confirmationUrl } = await renewSubscription({
      plan: user.yookassa.plan,
      paymentMethodId,
    })
    user.yookassa.pending = {
      plan: user.yookassa.plan,
      paymentId,
      confirmationUrl,
    }

    if (confirmationUrl) {
      verbose('Sending autopayment confirmation mail to:', user.email)
      const { t } = userI18n({ user })
      const subject = t('email.autopaymentConfirmation.subject', { userName: user.firstName });
      const text = t('email.autopaymentConfirmation.text', {
        userName: user.firstName,
        link: confirmationUrl,
      });
      verbose('subject:', subject)
      verbose('text:', text)
      const mail = await transporter.sendMail({
        from: conf.smtp.from,
        to: user.email,
        subject,
        text,
      })
      log('Autopayment confirmation mail sent:', mail)
    }

    // if (status === 'succeeded') {
    //   verbose('payment succeeded')
    //   // user.yookassa.plan = user.yookassa.pending.plan
    //   user.yookassa.paymentIds.push(paymentId)
    //   // user.yookassa.paymentMethodIds.push(response.data.payment_method.id)
    //   // user.yookassa.createdAt = response.data.captured_at
    //   user.yookassa.periodStart = user.yookassa.periodEnd
    //   user.yookassa.periodEnd = addInterval(
    //     new Date(user.yookassa.periodStart),
    //     planObj.pricesRu.interval,
    //     planObj.pricesRu.number,
    //   )
    //   user.yookassa.active = true
    //   user.yookassa.canceled = false
    //   user.yookassa.canceledAt = undefined
    //   user.yookassa.pending = undefined
    // } else if (status === 'pending') {
    //   verbose('payment pending')
    //   user.yookassa.pending = {
    //     plan: user.yookassa.plan,
    //     paymentId,
    //   }
    // } else {
    //   warn('payment id:', paymentId, 'has status:', status, ', paid:', paid)
    //   user.yookassa.active = false
    //   user.yookassa.canceled = true
    //   user.yookassa.canceledAt = now
    //   user.yookassa.cancelationReason = 'payment failed'
    //   user.yookassa.pending = undefined
    // }
    await user.save();
    verbose('Updated yookassa data in user document:', user);
  } catch (err) {
    error('Error handling expired subscription:', err)
  }
}

async function handlePendingSubscription({ user }) {
  try {
    const { paymentId } = user.yookassa.pending
    verbose('handlePendingSubscription for user:', user._id, user.email, ', paymentId:', paymentId)
    const response = await axios.get(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Idempotence-Key": uuidv4(),
        "Content-Type": "application/json",
      },
    });
    verbose('confirm response.data:', response.data);

    const planObj = conf.plans[user.yookassa.pending.plan]
    if (response.data.status === 'succeeded') {
      verbose('payment succeeded')
      user.yookassa.plan = user.yookassa.pending.plan
      user.yookassa.paymentIds.push(paymentId)
      user.yookassa.periodStart = user.yookassa.periodEnd
      user.yookassa.periodEnd = addInterval(
        new Date(user.yookassa.periodStart),
        planObj.pricesRu.interval,
        planObj.pricesRu.number,
      )
      user.yookassa.active = true
      user.yookassa.canceled = false
      user.yookassa.canceledAt = undefined
      user.yookassa.pending = undefined
      await user.save();
      verbose('Updated yookassa data in user document:', user);
    } else if (response.data.status === 'pending') {
      verbose('payment is still pending')
    } else {                         // e.g., response.data.stat === 'canceled'
      warn('payment id:', paymentId, 'has status:', response.data.status)
      user.yookassa.active = false
      user.yookassa.canceled = true
      user.yookassa.canceledAt = now
      user.yookassa.cancelationReason = response.data.cancelation_details?.reason || 'payment failed'
      user.yookassa.pending = undefined
      await user.save();
      verbose('Updated yookassa data in user document:', user);
    }
  } catch (err) {
    error('Error handling pending subscription:', err)
  }
}

export default async function autopayment() {
  log('Start looking for users with expired subscription')
  try {
    const users = await User.find({
      "yookassa.active": true,
      "yookassa.canceled": false,
      "yookassa.pending.paymentId": { $exists: false },
    });
    for (const user of users) {
      log('Checking subscription for user _id:', user._id, ', email:', user.email)
      const now = new Date();
      verbose('now:', now.toISOString(), 'periodEnd:', user.yookassa.periodEnd.toISOString());
      if (user.yookassa.periodEnd <= now) {
        log(`The user ${user._id} period ended at ${user.yookassa.periodEnd}, time to renew expired subscription with autopayment`);
        await handleExpiredSubscription({ user })
      }
    }
  } catch (err) {
    error('Error making autopayments:', err)
  }
  log('Stop looking for users with expired subscription')

  log('Start checking pending autopayments')
  try {
    const users = await User.find({
      "yookassa.active": true,
      "yookassa.canceled": false,
      "yookassa.pending.paymentId": { $exists: true },
    });
    for (const user of users) {
      await handlePendingSubscription({ user })
    }
  } catch (err) {
    error('Error checking pending autopayments:', err)
  }
  log('Stop checking pending autopayments')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log('The module was executed as main file');
    await autopayment();
    console.log("Job done. Exiting.");
    process.exit(0);
  })();
}
