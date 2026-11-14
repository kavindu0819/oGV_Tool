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

const env = `PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=ogv_app
DB_PASSWORD=${rand(18)}
DB_NAME=ogv_finder
DB_SSL=false
IR_PASSWORD=${irPassword}
COOKIE_SECRET=${rand(32)}
`;

fs.writeFileSync(envPath, env);
console.log('Created .env with random secrets. The IR password is the IR_PASSWORD line in .env.');
