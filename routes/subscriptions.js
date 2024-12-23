import { Router, raw } from 'express'
import Stripe from 'stripe'
import conf from '../conf.js'
import { checkAuth, checkAPIAuth } from '../middleware/check-auth.js'
import { Verbose } from '../services.js'
import Subscription from '../models/subscription.js'

const verbose = Verbose('sd:routes/subscriptions'); verbose('')
const app = Router()

const stripe = Stripe(conf.stripe.key)

app.get('/sessions/active', checkAuth, async (req, res) => {
  try {
    // Get all sessions for this user
    let sessions = await stripe.checkout.sessions.list({
      limit: 1000000,
      customer_details: {
        // NOTE: Do not allow any user to change email because sessions are
        //       associated with email
        email: req.user.email,
      },
    })
    // console.log('sessions:', sessions)
    sessions = sessions.data

    // Get all subscriptions of all users
    let subscriptions = await stripe.subscriptions.list({
      limit: 1000000,
    })
    subscriptions = subscriptions.data

    const existingSubscriptionIds = [...new Set(subscriptions.map(({ id }) => id ))].filter(n => n)
    // console.log('existingSubscriptionIds:', existingSubscriptionIds)

    sessions = sessions.filter(sess => {
      return existingSubscriptionIds.includes(sess.subscription)
    })

    res.json(sessions)
  } catch (err) {
    console.error('List subscriptions error:', err)
    res.status(500).json({
      result: 'error',
      error: err,
    })
  }
})

app.post('/session/create', checkAuth, async (req, res) => {
  try {
    const prices = await stripe.prices.list({
      lookup_keys: [req.body.lookup_key],
      expand: ['data.product'],
    })
    console.log('prices:', prices)
    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      line_items: [
        {
          price: prices.data[0].id,
          // For metered billing, do not pass quantity
          quantity: 1,

        },
      ],
      mode: 'subscription',
      customer_email: req.user.email,

      client_reference_id: req.user._id.toString(),
      metadata: {
        userId: req.user._id.toString(),
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        phone: req.user.phone,
      },

      // TODO: Add trials
      // subscription_data: {
      //   trial_period_days: 7,
      // },

      // TODO: do we need to set the subscription billing cycle date?
      // subscription_data: {
      //   billing_cycle_anchor: 1672531200,
      // },

      // TODO: do we need to automate the tax collection?
      automatic_tax: { enabled: true },

      success_url: `${conf.webApp.origin}/subscription`, // ?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${conf.webApp.origin}/subscription`, // ?canceled=true`,
    })
    console.log('session:', session)

    const subs = new Subscription()
    subs.userId = req.user._id
    subs.session = session
    await subs.save()

    res.redirect(303, session.url)
  } catch (err) {
    console.error('Create session error:', err)
    res.status(500).json({
      result: 'error',
      error: err,
    })
  }
})

app.post('/session/manage', checkAuth, async (req, res) => {
  try {
    const { session_id } = req.body
    const checkoutSession = await stripe.checkout.sessions.retrieve(session_id)
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: checkoutSession.customer,
      return_url: `${conf.webApp.origin}/subscription`,
    })
    console.log('portalSession:', portalSession)
    res.redirect(303, portalSession.url)
  } catch (err) {
    console.error('Portal session error:', err)
    res.status(500).json({
      result: 'error',
      error: err,
    })
  }
})

// TODO: Use webhook:
//   https://api.selfdev.vuics.com/v1/subscriptions/webhook
//
app.post('/webhook', raw({ type: 'application/json' }), (request, response) => {
    let event = request.body
    // Replace this endpoint secret with your endpoint's unique secret
    // If you are testing with the CLI, find the secret by running 'stripe listen'
    // If you are using an endpoint defined with the API or dashboard, look in your webhook settings
    // at https://dashboard.stripe.com/webhooks
    // const endpointSecret = 'whsec_12345'
    // Only verify the event if you have an endpoint secret defined.
    // Otherwise use the basic event deserialized with JSON.parse
    if (conf.stripe.endpointSecret) {
      // Get the signature sent by Stripe
      const signature = request.headers['stripe-signature']
      try {
        event = stripe.webhooks.constructEvent(
          request.body,
          signature,
          conf.stripe.endpointSecret
        )
      } catch (err) {
        console.log(`⚠️  Webhook signature verification failed.`, err.message)
        return response.sendStatus(400)
      }
    }
    let subscription
    let status
    // Handle the event
    switch (event.type) {
      // FIXME:
        // what events?
        //
        //
      // case 'customer.subscription.trial_will_end':
      //   subscription = event.data.object
      //   status = subscription.status
      //   console.log(`Subscription status is ${status}.`)
      //   // Then define and call a method to handle the subscription trial ending.
      //   // handleSubscriptionTrialEnding(subscription)
      //   break
      // case 'customer.subscription.deleted':
      //   subscription = event.data.object
      //   status = subscription.status
      //   console.log(`Subscription status is ${status}.`)
      //   // Then define and call a method to handle the subscription deleted.
      //   // handleSubscriptionDeleted(subscriptionDeleted)
      //   break
      // case 'customer.subscription.created':
      //   subscription = event.data.object
      //   status = subscription.status
      //   console.log(`Subscription status is ${status}.`)
      //   // Then define and call a method to handle the subscription created.
      //   // handleSubscriptionCreated(subscription)
      //   break
      // case 'customer.subscription.updated':
      //   subscription = event.data.object
      //   status = subscription.status
      //   console.log(`Subscription status is ${status}.`)
      //   // Then define and call a method to handle the subscription update.
      //   // handleSubscriptionUpdated(subscription)
      //   break
      default:
        // Unexpected event type
        console.log(`Unhandled event type ${event.type}.`)
    }
    // Return a 200 response to acknowledge receipt of the event
    response.send()
  }
)

export default app
