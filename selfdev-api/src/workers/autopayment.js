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
import { handlePaymentStatus } from '../routes/autopayments.js'

// Connect to MongoDB through Mongoose driver
import '../mongo.js'
import User from '../models/user.js'

const verbose = Verbose('sd:workers/autopayment'); verbose('')

log('public conf:', inspect(revealConf(), { colors: true, depth: null }))

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
    log('Subscription renew requested:', response.data);
    return response.data
  } catch (err) {
    error('Error renewing subscription:', err.response?.data || err.message);
  }
}

async function handleExpiredSubscription({ user }) {
  try {
    const paymentMethodId = user.yookassa.paymentMethodIds.at(-1)
    const paymentData = await renewSubscription({
      plan: user.yookassa.plan,
      paymentMethodId,
    })
    const confirmationUrl = paymentData.confirmation?.confirmation_url
    user.yookassa.pending = {
      plan: user.yookassa.plan,
      paymentId: paymentData.id,
      confirmationUrl,
    }
    await user.save();
    verbose('Updated yookassa data in user document:', user);
    await handlePaymentStatus({ user, paymentData, autopayment: true })

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
    verbose('Confirm response.data:', response.data);
    await handlePaymentStatus({ user, paymentData: response.data, autopayment: true })
  } catch (err) {
    error('Error handling pending subscription:', err)
  }
}

export default async function autopayment() {
  if (!conf.yookassa.enable) {
    return error('The Yookassa integration is disabled. Skipping autopayments.')
  }

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
