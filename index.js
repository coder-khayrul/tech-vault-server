require('dotenv').config()
const express = require('express');
const cors = require('cors');

const app = express()
const port = process.env.port || 3000

app.use(cors())
app.use(express.json())



app.get("/", (req, res) => {
  res.send("WELCOME To APP ORBIT SERVER")
})

app.listen(port, () => {
  console.log("This Server is running on", port);
})