// Creates a .env file with random secrets if one doesn't exist yet.
// Usage: node scripts/setup-env.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('.env already exists, leaving it alone.');
  process.exit(0);
}

const rand = (bytes) => crypto.randomBytes(bytes).toString('base64url');
const words = ['delhi', 'jakarta', 'cairo', 'hanoi', 'kathmandu', 'rabat', 'izmir', 'penang'];
const irPassword = `${words[crypto.randomInt(words.length)]}-${crypto.randomInt(1000, 9999)}-${rand(3)}`;

const dbPassword = rand(18);

// DATABASE_URL points at the optional local Docker Postgres (npm run db:up).
// To use Neon instead, replace it with Neon's connection string.
const env = `PORT=3000
DB_PASSWORD=${dbPassword}
DATABASE_URL=postgres://ogv_app:${dbPassword}@127.0.0.1:5432/ogv_finder
IR_PASSWORD=${irPassword}
COOKIE_SECRET=${rand(32)}
`;

fs.writeFileSync(envPath, env);
console.log('Created .env with random secrets. The IR password is the IR_PASSWORD line in .env.');
