// PostgreSQL connection pool (Neon in production) and schema setup.
const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// Keep DATE and TIMESTAMP as plain strings ('YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS')
// so time zones never shift a start date. COUNT() returns bigint: read it as a number.
types.setTypeParser(1082, (v) => v); // date
types.setTypeParser(1114, (v) => v); // timestamp
types.setTypeParser(20, (v) => Number(v)); // bigint

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Serverless functions each get their own pool, so keep it small.
  max: Number(process.env.DB_POOL_MAX || 3),
});

// Routes write SQL with ? placeholders. This turns them into Postgres $1, $2...
// An array value expands to a list: [1, 2] -> $1, $2 (for IN (?)),
// and an array of rows to tuples: [[1, 'a'], [2, 'b']] -> ($1, $2), ($3, $4) (for VALUES ?).
function toPg(sql, params = []) {
  const values = [];
  const add = (v) => {
    values.push(v);
    return `$${values.length}`;
  };
  let i = 0;
  const text = sql.replace(/\?/g, () => {
    const p = params[i++];
    if (!Array.isArray(p)) return add(p);
    if (Array.isArray(p[0])) return p.map((row) => `(${row.map(add).join(', ')})`).join(', ');
    return p.map(add).join(', ');
  });
  return { text, values };
}

// Runs one query. Returns { rows, rowCount }.
function query(sql, params) {
  const { text, values } = toPg(sql, params);
  return pool.query(text, values);
}

// Runs fn(q) inside a transaction; q works like query() on one connection.
async function transaction(fn) {
  const client = await pool.connect();
  const q = (sql, params) => {
    const { text, values } = toPg(sql, params);
    return client.query(text, values);
  };
  try {
    await client.query('BEGIN');
    const result = await fn(q);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Strip comments, then run each statement on its own.
  const statements = sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await pool.query(statement);
  }
}

module.exports = { pool, query, transaction, initSchema };
