---
name: add-rate-limiting
description: Add rate limits and abuse controls to login, signup, password reset, OTP, forms, uploads, public APIs and AI or other paid API routes, using a shared store (Upstash or Redis, Cloudflare rules, KV or Durable Objects) with 429 responses, per-user quotas and spend caps. Use when the user worries about bots, spam, brute force or surprise AI bills.
license: MIT
metadata:
  origin: BlitzHash
  pack: blitzhash-vibe-coding-rules
---

# Add rate limiting

A single script should not be able to lock out your users, empty your email quota or run up your AI bill.

## When to use

- Before launch, for every public or paid route.
- After a spam wave, credential-stuffing attempt or a surprise invoice.

## Steps

1. **List the routes** that are public, auth-related or call paid APIs. Propose a limit for each (for example login 5 per minute per IP and per account, AI chat 20 per minute and 200 per day per user).
2. **Pick the store** that fits the hosting: Upstash Redis for Vercel or Netlify serverless, Cloudflare rate limiting rules or Durable Objects on Cloudflare, Redis for containers or a VPS. Explain why an in-memory limiter is not enough when there is more than one instance.
3. **Choose the key:** user id when signed in, trusted client IP otherwise (platform helper or trusted proxy header), plus email for login and reset routes.
4. **Implement** the limiter as one helper, apply it at the top of each route, return 429 with `Retry-After`.
5. **AI and paid APIs:** add per-user daily quotas, `max_tokens`, timeouts, and remind the user to set a spend cap and billing alert in the provider dashboard (they do this themselves).
6. **Bots on forms:** suggest Turnstile, hCaptcha or reCAPTCHA on signup and contact forms.
7. **Test** with a short loop of requests and show the first 429.

## Output format

Table of routes with limits and keys, the limiter helper, the changed routes, and the test output.

## Safety rules (always)

1. Never load-test or flood production. Test locally or on staging.
2. Redis or Upstash tokens only from environment variables; never print or commit them.
3. Do not change provider billing settings yourself; give the user the exact steps.
