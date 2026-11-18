// oGV Project Finder: IR adds Global Volunteer projects, CR finds them in seconds.
// Local server. On Vercel, api/index.js runs the same app instead.
require('dotenv').config();

for (const key of ['DATABASE_URL', 'IR_PASSWORD', 'COOKIE_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env. Run: node scripts/setup-env.js`);
    process.exit(1);
  }
}

const app = require('./src/app');
const { initSchema } = require('./src/db');

const port = Number(process.env.PORT || 3000);

initSchema()
  .then(() => {
    app.listen(port, () => console.log(`oGV Project Finder running on http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Could not connect to Postgres. Check DATABASE_URL in .env.');
    console.error(err.message);
    process.exit(1);
  });
