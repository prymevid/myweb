import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'rr_session';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

function getSecret() {
  return process.env.SESSION_SECRET || 'roadrules-dev-secret-change-me';
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9]/g, '');
}

function sign(message) {
  return crypto.createHmac('sha256', getSecret()).update(message).digest('base64url');
}

export function createSessionToken(payload = {}) {
  const now = Date.now();
  const body = {
    id: payload.id,
    phone: normalizePhone(payload.phone),
    name: payload.name || null,
    role: payload.role || 'user',
    jti: payload.jti || crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp: payload.exp || now + DEFAULT_TTL_MS,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSignature = sign(`${header}.${payload}`);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const decoded = JSON.parse(base64UrlDecode(payload));
    if (!decoded || !decoded.id || !decoded.phone || (decoded.exp && decoded.exp <= Date.now())) return null;
    return {
      ...decoded,
      phone: normalizePhone(decoded.phone),
    };
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.split('=');
    if (!key) return acc;
    acc[key.trim()] = decodeURIComponent(rest.join('=').trim());
    return acc;
  }, {});
}

export function getSessionToken(req) {
  const headerCookie = req?.headers?.cookie || '';
  const cookieMap = req?.cookies || parseCookies(headerCookie);
  if (cookieMap?.[SESSION_COOKIE_NAME]) return cookieMap[SESSION_COOKIE_NAME];
  const authHeader = req?.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const attrs = [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(DEFAULT_TTL_MS / 1000)}`,
  ];
  if (isProd) attrs.push('Secure');
  const cookieValue = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${attrs.join('; ')}`;
  if (typeof res?.setHeader === 'function') res.setHeader('Set-Cookie', cookieValue);
  return cookieValue;
}

export function clearAuthCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isProd) attrs.push('Secure');
  const cookieValue = `${SESSION_COOKIE_NAME}=; ${attrs.join('; ')}`;
  if (typeof res?.setHeader === 'function') res.setHeader('Set-Cookie', cookieValue);
  return cookieValue;
}

export function requireAuth(req, res, next) {
  const token = getSessionToken(req);
  const auth = verifySessionToken(token);
  if (!auth) {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.auth = auth;
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (req.auth?.role !== role) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    });
  };
}
