const express = require('express');
const dotenv = require('dotenv');
const routes = require('./routes/index');

dotenv.config();

const application = express();
const port = process.env.PORT || 5000;

// load all routes from the file routes/index.js
application.use('/', routes);
application.listen(port);