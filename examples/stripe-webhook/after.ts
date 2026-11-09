// AFTER: verified signature, idempotent, fulfils from the webhook only.
import "server-only";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text(); // raw body, needed for the signature
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Stripe retries: process each event id once.
  const firstTime = await db.processedEvent.createIfMissing(event.id);
  if (!firstTime) return new Response("ok");

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    // user id was set on the server when the session was created
    await db.user.update({
      where: { id: session.client_reference_id! },
      data: { plan: "pro" },
    });
  }

  return new Response("ok");
}
