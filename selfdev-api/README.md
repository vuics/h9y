# Selfdev-api

An API backend server for HyperAgency.

## Install

```bash
npm i
```

## Configure

Configure environment variables in [./env](./env) using example of [./env.example](./env.example).

### Configure Stripe

You have to create a webhook in a Stripe Dashboard separately for each environment:
  * [Stripe Sandbox webhooks](https://dashboard.stripe.com/test/webhooks). The webhook should be pointing to local address. You can use the `listen` command in `./package.json` to setup local webhook.
  * [Stripe live webhooks](https://dashboard.stripe.com/webhooks). The webhook should be pointing to `https://api.h9y.ai/v1/subscriptions/webhook`.

Select API version: `2020-03-02`.
Select webhook events to send:
  * `invoice.payment_succeeded`
  * `customer.subscription.deleted`

On local dev, you can get the webhook events with stripe CLI tool:
```bash
brew install stripe/stripe-cli/stripe
stripe login
npm run listen
```
See: [stripe-cli](https://docs.stripe.com/stripe-cli).

## Run

```bash
npm start
```
