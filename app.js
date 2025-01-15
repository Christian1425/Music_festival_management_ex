const express = require('express');
const mongoose = require('mongoose');
const PerformanceRoutes = require('./routes/performances');
const FestivalRoutes = require('./routes/festivals');
const UserRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 9000;

mongoose.set('strictQuery', false);

mongoose
  .connect("mongodb://127.0.0.1:27017/festival")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("Mongo err", err));

mongoose.Promise = global.Promise;

// Middleware for setting CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin,X-Requested-With,Content-Type,Accept,Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.header(
      'Access-Control-Allow-Methods',
      'PUT,POST,PATCH,DELETE,GET'
    );
    return res.status(200).json({});
  }

  next();
});

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Define routes for different resources
app.use('/performances', PerformanceRoutes);
app.use('/festivals', FestivalRoutes);
app.use('/users', UserRoutes);

// Middleware for handling 404 errors
app.use((req, res, next) => {
  const error = new Error('Not found');
  error.status = 404;
  next(error);
});

// Middleware for handling errors and sending appropriate responses
app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    error: {
      message: error.message,
    },
  });
});

// Event handlers for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

//uncomment from the lines 77-80 to run TESTING!!!

// app.get('/test_documentation', (req,res)=> 
// {
//   res.send("test successful")
// })
module.exports = app;
