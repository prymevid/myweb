import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { buildAccessState } from './access-control.js';
import { createSessionToken, requireAuth, requireRole, setAuthCookie, clearAuthCookie, SESSION_COOKIE_NAME } from './auth-session.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

const authAttemptStore = new Map();
function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

function authRateLimiter(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const bucket = authAttemptStore.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 15 * 60 * 1000;
  }
  bucket.count += 1;
  authAttemptStore.set(key, bucket);
  if (bucket.count > 20) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
}

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'roadrules-dev-secret-change-me';

if (!SESSION_SECRET && isProduction) {
  console.error('SESSION_SECRET is required in production');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// ==============================
// SUPABASE REST HELPERS
// All DB access goes through the PostgREST REST API.
// We never import @supabase/supabase-js on the server to avoid
// the Node 20 WebSocket issue in the realtime module.
// ==============================
const DB = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

async function dbGet(table, query = '') {
  const res = await fetch(`${DB}/${table}${query ? '?' + query : ''}`, { headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbPost(table, body) {
  const res = await fetch(`${DB}/${table}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbPatch(table, query, body) {
  const res = await fetch(`${DB}/${table}?${query}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbDelete(table, query) {
  const res = await fetch(`${DB}/${table}?${query}`, {
    method: 'DELETE',
    headers: { ...HEADERS, Prefer: 'return=minimal' }
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

function normalizePhone(phone) {
  return (phone || '').replace(/[^0-9]/g, '');
}

function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

// ==============================
// AUTH
// ==============================
app.use('/api/auth', noStore);
app.use('/api/exams', noStore);
app.use('/api/exam-access', noStore);
app.use('/api/users', noStore);
app.use('/api/admin', noStore);

app.get('/healthz', (req, res) => {
  res.json({ ok: true, service: 'roadrules' });
});

app.post('/api/auth/signup', authRateLimiter, async (req, res) => {
  const { name, phone, district, password } = req.body || {};
  if (!name || !phone || !password) return res.status(400).json({ error: 'Missing fields' });
  const cleanPhone = normalizePhone(phone);
  try {
    const existing = await dbGet('users', `phone=eq.${encodeURIComponent(cleanPhone)}&select=id`);
    if (existing.length > 0) return res.status(409).json({ error: 'Iyi telefone irahari. Injira!' });

    const passwordHash = await bcrypt.hash(password, 12);
    const rows = await dbPost('users', {
      name: name.trim(),
      phone: cleanPhone,
      district: (district || 'Kigali').trim(),
      password_hash: passwordHash,
      subscription_plan: 'ubuntu',
      subscription_plan_name: 'Ubuntu Free',
      subscription_amount: 0,
      subscription_status: 'approved',
      subscription_paid_at: new Date().toISOString()
    });
    const user = Array.isArray(rows) ? rows[0] : rows;
    const token = createSessionToken({ id: user.id, phone: user.phone, name: user.name });
    setAuthCookie(res, token);
    res.json({
      user: {
        id: user.id, name: user.name, phone: user.phone, district: user.district,
        subscription: { plan: user.subscription_plan, planName: user.subscription_plan_name, amount: user.subscription_amount, status: user.subscription_status, paidAt: user.subscription_paid_at }
      },
      token
    });
  } catch (e) {
    console.error('signup error', e.message);
    res.status(500).json({ error: e.message || 'Signup failed' });
  }
});

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ error: 'Missing fields' });
  const cleanPhone = normalizePhone(phone);
  try {
    const rows = await dbGet('users', `phone=eq.${encodeURIComponent(cleanPhone)}&select=id,name,phone,district,password_hash,subscription_plan,subscription_plan_name,subscription_amount,subscription_status,subscription_paid_at,pending_upgrade`);
    if (!rows.length) return res.status(401).json({ error: 'Konti ntabwo ibaho. Iyandikishe!' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Ijambobanga cyangwa nimero si byo.' });
    const sessionUser = {
      id: user.id, name: user.name, phone: user.phone, district: user.district,
      subscription: { plan: user.subscription_plan, planName: user.subscription_plan_name, amount: user.subscription_amount, status: user.subscription_status, paidAt: user.subscription_paid_at }
    };
    if (user.pending_upgrade) sessionUser.pendingUpgrade = user.pending_upgrade;
    const token = createSessionToken({ id: user.id, phone: user.phone, name: user.name, role: 'user' });
    setAuthCookie(res, token);
    res.json({ user: { ...sessionUser, role: 'user' }, token, role: 'user' });
  } catch (e) {
    console.error('login error', e.message);
    res.status(500).json({ error: e.message || 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const rows = await dbGet('users', `phone=eq.${encodeURIComponent(req.auth.phone)}&select=id,name,phone,district,subscription_plan,subscription_plan_name,subscription_amount,subscription_status,subscription_paid_at,pending_upgrade`);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    const access = buildAccessState({ user, exams: [], now: Date.now() });
    res.json({ user: { id: user.id, name: user.name, phone: user.phone, district: user.district, subscription: { plan: user.subscription_plan, planName: user.subscription_plan_name, amount: user.subscription_amount, status: user.subscription_status, paidAt: user.subscription_paid_at }, pendingUpgrade: user.pending_upgrade || null }, access });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/admin/login', authRateLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin login is not configured' });
  }
  if (String(username).trim() !== ADMIN_USERNAME || String(password) !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const adminUser = {
    id: 'admin',
    phone: normalizePhone(ADMIN_PHONE) || '0000000000',
    name: 'Administrator'
  };
  const token = createSessionToken({ ...adminUser, role: 'admin' });
  setAuthCookie(res, token);
  res.json({ user: { ...adminUser, role: 'admin' }, token, role: 'admin' });
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/refresh', requireAuth, async (req, res) => {
  const { phone } = req.body || {};
  const requestedPhone = normalizePhone(phone || req.auth.phone);
  if (!requestedPhone) return res.status(400).json({ error: 'Missing phone' });
  if (req.auth.phone !== requestedPhone) return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await dbGet('users', `phone=eq.${encodeURIComponent(requestedPhone)}&select=id,name,phone,district,subscription_plan,subscription_plan_name,subscription_amount,subscription_status,subscription_paid_at,pending_upgrade`);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    const access = buildAccessState({ user, exams: [], now: Date.now() });
    res.json({
      user: {
        id: user.id, name: user.name, phone: user.phone, district: user.district,
        subscription: { plan: user.subscription_plan, planName: user.subscription_plan_name, amount: user.subscription_amount, status: user.subscription_status, paidAt: user.subscription_paid_at },
        pendingUpgrade: user.pending_upgrade || null,
        access
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==============================
// EXAM HISTORY
// ==============================
app.post('/api/exams', requireAuth, async (req, res) => {
  const { phone, score, total, timeTaken } = req.body || {};
  const cleanPhone = normalizePhone(phone || req.auth.phone);
  if (!cleanPhone || score == null || !total) return res.status(400).json({ error: 'Missing fields' });
  if (req.auth.phone !== cleanPhone) return res.status(403).json({ error: 'Forbidden' });
  try {
    const users = await dbGet('users', `phone=eq.${encodeURIComponent(cleanPhone)}&select=id,subscription_plan,subscription_plan_name,subscription_amount,subscription_status,subscription_paid_at,pending_upgrade`);
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    const user = users[0];
    const access = buildAccessState({ user, exams: [], now: Date.now() });
    if (!access.canStartMoreExams) {
      return res.status(403).json({ error: 'Exam limit reached for the current plan' });
    }
    const rows = await dbPost('exam_history', { user_id: user.id, score, total, time_taken: timeTaken || 0 });
    res.json({ exam: Array.isArray(rows) ? rows[0] : rows, access: { ...access, completedExamCount: access.completedExamCount + 1 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/exams/:phone', requireAuth, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  if (!cleanPhone || req.auth.phone !== cleanPhone) return res.status(403).json({ error: 'Forbidden' });
  try {
    const users = await dbGet('users', `phone=eq.${encodeURIComponent(cleanPhone)}&select=id,subscription_plan,subscription_plan_name,subscription_amount,subscription_status,subscription_paid_at,pending_upgrade`);
    if (!users.length) return res.json({ exams: [] });
    const exams = await dbGet('exam_history', `user_id=eq.${users[0].id}&order=created_at.desc&limit=50`);
    const access = buildAccessState({ user: users[0], exams, now: Date.now() });
    res.json({ exams: exams || [], access });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/exam-access/:phone', requireAuth, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  if (!cleanPhone || req.auth.phone !== cleanPhone) return res.status(403).json({ error: 'Forbidden' });
  try {
    const users = await dbGet('users', `phone=eq.${encodeURIComponent(cleanPhone)}&select=id,subscription_plan,subscription_plan_name,subscription_amount,subscription_status,subscription_paid_at,pending_upgrade`);
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    const exams = await dbGet('exam_history', `user_id=eq.${users[0].id}&order=created_at.desc&limit=50`);
    const access = buildAccessState({ user: users[0], exams, now: Date.now() });
    res.json({ access });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==============================
// ANNOUNCEMENTS
// ==============================
app.get('/api/announcements', async (req, res) => {
  try {
    const data = await dbGet('announcements', 'order=created_at.desc');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/announcements', requireAuth, async (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Missing title or content' });
  try {
    const rows = await dbPost('announcements', { title: title.trim(), content: content.trim() });
    res.json(Array.isArray(rows) ? rows[0] : rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/announcements/:id', requireAuth, async (req, res) => {
  const { title, content } = req.body || {};
  const updates = { updated_at: new Date().toISOString() };
  if (title != null) updates.title = String(title).trim();
  if (content != null) updates.content = String(content).trim();
  try {
    const rows = await dbPatch('announcements', `id=eq.${req.params.id}`, updates);
    res.json(Array.isArray(rows) ? rows[0] : rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/announcements/:id', requireAuth, async (req, res) => {
  try { await dbDelete('announcements', `id=eq.${req.params.id}`); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==============================
// HELP FAQs
// ==============================
app.get('/api/help-faqs', async (req, res) => {
  try {
    const data = await dbGet('help_faqs', 'order=created_at.desc');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/help-faqs', requireAuth, async (req, res) => {
  const { question, answers } = req.body || {};
  if (!question || !answers) return res.status(400).json({ error: 'Missing question or answers' });
  const answersArr = Array.isArray(answers) ? answers : [String(answers)];
  try {
    const rows = await dbPost('help_faqs', { question: question.trim(), answers: answersArr });
    res.json(Array.isArray(rows) ? rows[0] : rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/help-faqs/:id', requireAuth, async (req, res) => {
  const { question, answers } = req.body || {};
  const updates = { updated_at: new Date().toISOString() };
  if (question != null) updates.question = String(question).trim();
  if (answers != null) updates.answers = Array.isArray(answers) ? answers : [String(answers)];
  try {
    const rows = await dbPatch('help_faqs', `id=eq.${req.params.id}`, updates);
    res.json(Array.isArray(rows) ? rows[0] : rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/help-faqs/:id', requireAuth, async (req, res) => {
  try { await dbDelete('help_faqs', `id=eq.${req.params.id}`); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ==============================
// CHATBOT CONFIG
// ==============================
app.get('/api/chatbot-config', async (req, res) => {
  try {
    const rows = await dbGet('config', `key=eq.chatbot&select=value`);
    res.json((rows[0] && rows[0].value) || { rugambaProactiveDelayMin: 5 });
  } catch (e) { res.json({ rugambaProactiveDelayMin: 5 }); }
});

app.patch('/api/chatbot-config', requireAdmin, async (req, res) => {
  const partial = req.body || {};
  try {
    const rows = await dbGet('config', `key=eq.chatbot&select=value`);
    const current = (rows[0] && rows[0].value) || { rugambaProactiveDelayMin: 5 };
    const merged = { ...current, ...partial, updatedAt: new Date().toISOString() };
    // Upsert via POST with onConflict
    const upsertRes = await fetch(`${DB}/config?on_conflict=key`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ key: 'chatbot', value: merged })
    });
    if (!upsertRes.ok) throw new Error(await upsertRes.text());
    res.json(merged);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==============================
// ADMIN — USER MANAGEMENT
// ==============================
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const data = await dbGet('users', 'select=id,name,phone,district,subscription_plan,subscription_plan_name,subscription_amount,subscription_status,subscription_paid_at,pending_upgrade,created_at,updated_at&order=created_at.desc&limit=500');
    const users = (data || []).map(u => ({
      id: u.id, name: u.name, phone: u.phone, district: u.district,
      createdAt: u.created_at, lastUpdated: u.updated_at,
      subscription: { plan: u.subscription_plan, planName: u.subscription_plan_name, amount: u.subscription_amount, status: u.subscription_status, paidAt: u.subscription_paid_at },
      pendingUpgrade: u.pending_upgrade || null
    }));
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users/:phone', requireAdmin, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  try {
    const rows = await dbGet('users', `phone=eq.${encodeURIComponent(cleanPhone)}&select=id,name,phone,district,subscription_plan,subscription_plan_name,subscription_amount,subscription_status,subscription_paid_at,pending_upgrade,created_at,updated_at`);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const user = rows[0];
    const exams = await dbGet('exam_history', `user_id=eq.${user.id}&order=created_at.desc`);
    res.json({
      id: user.id, name: user.name, phone: user.phone, district: user.district,
      createdAt: user.created_at, lastUpdated: user.updated_at,
      subscription: { plan: user.subscription_plan, planName: user.subscription_plan_name, amount: user.subscription_amount, status: user.subscription_status, paidAt: user.subscription_paid_at },
      pendingUpgrade: user.pending_upgrade || null,
      exams: exams || []
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/users/:phone/approve', requireAdmin, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  try {
    const rows = await dbGet('users', `phone=eq.${encodeURIComponent(cleanPhone)}&select=pending_upgrade,subscription_plan,subscription_plan_name,subscription_amount`);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    const planData = user.pending_upgrade || { plan: user.subscription_plan, planName: user.subscription_plan_name, amount: user.subscription_amount };
    await dbPatch('users', `phone=eq.${encodeURIComponent(cleanPhone)}`, {
      subscription_plan: planData.plan,
      subscription_plan_name: planData.planName,
      subscription_amount: planData.amount || 0,
      subscription_status: 'approved',
      subscription_paid_at: new Date().toISOString(),
      pending_upgrade: null
    });
    res.json({ ok: true, access: buildAccessState({ user: { ...user, subscription_plan: planData.plan, subscription_plan_name: planData.planName, subscription_amount: planData.amount || 0, subscription_status: 'approved' }, exams: [], now: Date.now() }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/users/:phone/reject', requireAdmin, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  try {
    await dbPatch('users', `phone=eq.${encodeURIComponent(cleanPhone)}`, { pending_upgrade: null });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/users/:phone/dismiss', requireAdmin, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  try {
    await dbPatch('users', `phone=eq.${encodeURIComponent(cleanPhone)}`, {
      subscription_plan: 'ubuntu', subscription_plan_name: 'Ubuntu Free',
      subscription_amount: 0, subscription_status: 'approved',
      subscription_paid_at: new Date().toISOString(), pending_upgrade: null
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/users/:phone', requireAdmin, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  try { await dbDelete('users', `phone=eq.${encodeURIComponent(cleanPhone)}`); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:phone/pending-upgrade', requireAuth, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  if (!cleanPhone || req.auth.phone !== cleanPhone) return res.status(403).json({ error: 'Forbidden' });
  const { pendingUpgrade } = req.body || {};
  try {
    await dbPatch('users', `phone=eq.${encodeURIComponent(cleanPhone)}`, { pending_upgrade: pendingUpgrade || null });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==============================
// SEEN ANNOUNCEMENTS
// ==============================
app.get('/api/users/:phone/seen-announcements', requireAuth, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  if (!cleanPhone || req.auth.phone !== cleanPhone) return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await dbGet('users', `phone=eq.${encodeURIComponent(cleanPhone)}&select=seen_announcement_ids`);
    res.json({ ids: (rows[0] && rows[0].seen_announcement_ids) || [] });
  } catch (e) { res.json({ ids: [] }); }
});

app.post('/api/users/:phone/seen-announcements', requireAuth, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  if (!cleanPhone || req.auth.phone !== cleanPhone) return res.status(403).json({ error: 'Forbidden' });
  const { ids } = req.body || {};
  try {
    await dbPatch('users', `phone=eq.${encodeURIComponent(cleanPhone)}`, { seen_announcement_ids: ids || [] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==============================
// CHAT PROGRESS
// ==============================
app.get('/api/users/:phone/chat-progress', requireAuth, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  if (!cleanPhone || req.auth.phone !== cleanPhone) return res.status(403).json({ error: 'Forbidden' });
  try {
    const rows = await dbGet('users', `phone=eq.${encodeURIComponent(cleanPhone)}&select=chat_progress`);
    res.json({ progress: (rows[0] && rows[0].chat_progress) || {} });
  } catch (e) { res.json({ progress: {} }); }
});

app.post('/api/users/:phone/chat-progress', requireAuth, async (req, res) => {
  const cleanPhone = normalizePhone(req.params.phone);
  if (!cleanPhone || req.auth.phone !== cleanPhone) return res.status(403).json({ error: 'Forbidden' });
  const { progress } = req.body || {};
  try {
    await dbPatch('users', `phone=eq.${encodeURIComponent(cleanPhone)}`, { chat_progress: progress || {} });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==============================
// START
// ==============================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`RoadRules server (Supabase REST) listening on ${PORT}`);
});
