// The Express app. Used by server.js (local) and api/index.js (Vercel).
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { initSchema } = require('./db');
const { readSession } = require('./auth');
const publicRoutes = require('./routes/public');
const irRoutes = require('./routes/ir');

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(readSession);

// Make sure the tables exist before the first API call (once per server instance).
let ready = null;
app.use('/api', (_req, _res, next) => {
  ready = ready || initSchema();
  ready.then(
    () => next(),
    (err) => {
      ready = null; // try again on the next request
      next(err);
    }
  );
});

app.use('/api', publicRoutes);
app.use('/api/ir', irRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// On Vercel the public/ folder is served before requests reach this app;
// locally Express serves it.
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

// Errors: log the details, show a plain message.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Try again in a moment.' });
});

module.exports = app;
