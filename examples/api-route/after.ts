// AFTER: signed-in user, owns the order, only allowed fields, safe error shape.
import { z } from "zod";

const UpdateOrder = z
  .object({
    shippingAddress: z.string().trim().min(5).max(300),
    note: z.string().max(500).optional(),
  })
  .strict(); // price, status and userId cannot be set by the client

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(); // 401 if not signed in (verified on the server)

  const parsed = UpdateOrder.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  // ownership is part of the query: other users' orders are simply not found
  const result = await db.order.updateMany({
    where: { id: params.id, userId: user.id },
    data: parsed.data,
  });
  if (result.count === 0) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ ok: true });
}
