# Selfdev-api

An API backend server for HyperAgency.

## Procurement gateway

The optional Procurement workspace is exposed only through the authenticated
`/v1/extensions` capability endpoint and `/v1/procurement/*` read proxy.
Configure the gateway with:

```text
PROCUREMENT_ENABLED=true
PROCUREMENT_SERVICE_URL=http://h9y-procurement:8080/v1
PROCUREMENT_SERVICE_TOKEN=<same-long-random-shared-secret>
PROCUREMENT_EXTENSION_API_VERSION=1
PROCUREMENT_SERVICE_TIMEOUT_MS=15000
```

The proxy replaces client-supplied identity with the authenticated Selfdev
user ID/email and authenticates to `h9y-procurement` using the service token.
Only explicitly allow-listed procurement GET routes can pass through it.

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
