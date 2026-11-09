// BEFORE: user input concatenated into SQL (injection), every column returned, no limit.
// q = "' OR 1=1 --" returns every customer.
app.get("/api/customers", async (req, res) => {
  const q = req.query.q;
  const { rows } = await pool.query(`select * from customers where name ilike '%${q}%'`);
  res.json(rows);
});
