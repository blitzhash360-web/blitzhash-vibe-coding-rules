// AFTER: parameterized, scoped to the caller's team, limited columns and rows.
app.get("/api/customers", requireUser, async (req, res) => {
  const q = String(req.query.q ?? "").slice(0, 100);
  const { rows } = await pool.query(
    "select id, name, email from customers where team_id = $1 and name ilike $2 order by name limit 50",
    [req.user.teamId, `%${q}%`],
  );
  res.json(rows);
});
