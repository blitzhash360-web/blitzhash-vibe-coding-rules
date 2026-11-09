---
name: stripe-webhook-setup
description: Set up or fix a Stripe webhook endpoint correctly - raw-body signature verification, idempotent processing, out-of-order events, fulfilment from webhooks, and local testing with the Stripe CLI. Works for Next.js, Express, Cloudflare Workers, Firebase Functions, Supabase Edge Functions and Python. Use when the user adds payments or subscriptions, says "payment succeeded but nothing happened", or sees webhook signature errors.
license: MIT
metadata:
  origin: BlitzHash
  pack: blitzhash-vibe-coding-rules
---

# Stripe webhook setup

The success page is not proof of payment. The verified webhook is.

## When to use

- Adding Stripe Checkout, subscriptions or one-off payments.
- "No signatures found matching the expected signature" errors.
- Paid users not getting access, or users getting access twice.

## Steps

1. **Find the runtime** (Node server, Next.js App Router, Express, edge runtime, Python) and the existing Stripe client. Confirm `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` come from env vars on the server only.
2. **Get the raw body.** Next.js App Router: `await req.text()`. Express: `express.raw({ type: "application/json" })` on this route only, registered before `express.json()`. Firebase Functions: `req.rawBody`. Python frameworks: the raw request bytes.
3. **Verify the signature.** `stripe.webhooks.constructEvent(raw, sig, secret)` in Node; `await stripe.webhooks.constructEventAsync(raw, sig, secret, undefined, Stripe.createSubtleCryptoProvider())` on edge runtimes; `stripe.Webhook.construct_event` in Python. Bad signature returns 400 and stops.
4. **Make it idempotent.** Create a `processed_events` table (or collection) with `event_id` as a unique key. Skip events already stored; store after successful processing.
5. **Handle only the events you need**, typically `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` and `customer.subscription.deleted`. For subscription state, re-fetch the subscription from the API rather than trusting event order.
6. **Fulfil here, not on the success page.** Grant access, credits or plan changes in the webhook handler. The success page only shows status by reading your database.
7. **Respond fast.** Return 200 once recorded; push slow work (emails, PDFs) to a queue.
8. **Test locally:** `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, put the printed `whsec_...` value in your local `.env`, then `stripe trigger checkout.session.completed`. Send the same event twice and confirm it is processed once.
9. **Production:** create the endpoint in the Stripe Dashboard with only the needed events, put its signing secret in the hosting env, and check the Dashboard's webhook delivery log after the first live payment.

## Output format

The webhook handler, the idempotency table or migration, the list of subscribed events, and the local test commands.

## Safety rules (always)

1. Use test-mode keys while building. Never switch to live keys or create live webhook endpoints without the user's explicit "yes".
2. Never print, log or commit `sk_live`, `rk_live` or `whsec` values. Use placeholders such as `whsec_REPLACE_ME` in docs.
3. Never issue refunds, cancel subscriptions or change prices from code you are testing.
