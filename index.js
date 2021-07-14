const express = require("express");
const app = express();
app.use(express.json());
const worker = require("./src/worker");


app.post("/", async (req, res) => {
  // get what needs done and check it's valid

  const pack = await worker.validateContent(req.body);
  const result = await worker.execute(pack);
  res.json(result);
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`...listening on port ${port}`);
});
