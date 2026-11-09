// BEFORE: trusts any POST. Anyone can send {"type":"checkout.session.completed"} and get paid features.
export async function POST(req: Request) {
  const event = await req.json();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await db.user.update({
      where: { email: session.customer_email },
      data: { plan: "pro" },
    });
  }

  return Response.json({ received: true });
}
