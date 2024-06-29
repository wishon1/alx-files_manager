const express = require('express');
// const dotenv = require('dotenv');
const routes = require('./routes/index');

// dotenv.config();

const application = express();

// Middleware to parse JSON bodies
application.use(express.json());
const port = process.env.PORT || 5000;

// load all routes from the file routes/index.js
application.use('/', routes);
application.listen(port, () => {
  console.log(`The server is running on port: ${port}`);
});
