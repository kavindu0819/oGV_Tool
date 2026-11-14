// IR sign-in using a signed cookie. Two roles:
//   'ir'   - real IR team member (shared password)
//   'demo' - panel/demo visitor: can add projects (tagged "Demo") and edit
//            only their own, never the real IR projects
const crypto = require('crypto');

const COOKIE = 'ogv_session';
const MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

const cookieOptions = () => ({
  signed: true,
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: MAX_AGE,
});

// Constant-time comparison so the password can't be guessed by timing.
function passwordMatches(given) {
  const expected = process.env.IR_PASSWORD || '';
  if (!expected || typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Reads the session (if any) onto req.session for every request.
function readSession(req, _res, next) {
  let session = null;
  const raw = req.signedCookies?.[COOKIE];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.role === 'ir') session = { role: 'ir' };
      if (parsed.role === 'demo' && /^[a-f0-9]{32}$/.test(parsed.sid)) session = { role: 'demo', sid: parsed.sid };
    } catch {
      session = null;
    }
  }
  req.session = session;
  // Set for demo visitors, so what they add is tagged and stays editable by them.
  req.demoSid = session?.role === 'demo' ? session.sid : null;
  next();
}

function signIn(res, role) {
  const session = role === 'demo' ? { role, sid: crypto.randomBytes(16).toString('hex') } : { role };
  res.cookie(COOKIE, JSON.stringify(session), cookieOptions());
  return session;
}

function signOut(res) {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
}

function requireIR(req, res, next) {
  if (!req.session) return res.status(401).json({ error: 'Please sign in to the IR side.' });
  next();
}

module.exports = { readSession, signIn, signOut, requireIR, passwordMatches };
