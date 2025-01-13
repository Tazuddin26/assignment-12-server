const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const req =require("express/lib/request");
const port = process.env.PORT || 5100;

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('Hello World!')
  
}); 

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
  });