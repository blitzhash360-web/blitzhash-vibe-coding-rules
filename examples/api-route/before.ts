// BEFORE: no auth, no ownership check, and the whole body goes straight into the database.
// A signed-out stranger can change anyone's order, including its price and status.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const data = await req.json();
  const order = await db.order.update({ where: { id: params.id }, data });
  return Response.json(order);
}
