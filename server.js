// oGV Project Finder: IR adds Global Volunteer projects, CR finds them in seconds.
require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { initSchema } = require('./src/db');
const { readSession } = require('./src/auth');
const publicRoutes = require('./src/routes/public');
const irRoutes = require('./src/routes/ir');

for (const key of ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'IR_PASSWORD', 'COOKIE_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env. Run: node scripts/setup-env.js`);
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '50kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(readSession);

app.use('/api', publicRoutes);
app.use('/api/ir', irRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Errors: log the details, show a plain message.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Try again in a moment.' });
});

const port = Number(process.env.PORT || 3000);

initSchema()
  .then(() => {
    app.listen(port, () => console.log(`oGV Project Finder running on http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Could not connect to MySQL. Is the database running? (npm run db:up)');
    console.error(err.message);
    process.exit(1);
  });
