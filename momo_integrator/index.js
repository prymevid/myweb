import express from 'express';

const router = express.Router();

function normalizePhone(phone) {
  return (phone || '').replace(/[^0-9]/g, '');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MOMO_USE_SANDBOX_MOCK = String(process.env.MOMO_USE_SANDBOX_MOCK || 'true') === 'true';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('momo_integrator: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY; DB operations will fail.');
}

async function supabasePost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function supabasePatch(table, query, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH', headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function genRef() {
  return 'momo_' + Math.random().toString(36).slice(2, 10);
}

// Initiate a payment (mock by default)
router.post('/initiate', async (req, res) => {
  try {
    const { phone, amount, plan } = req.body || {};
    if (!phone || !amount) return res.status(400).json({ error: 'Missing phone or amount' });
    const cleanPhone = normalizePhone(phone);
    const reference = genRef();
    const payload = { user_phone: cleanPhone, amount: Number(amount), plan: plan || null, status: 'pending', reference, created_at: new Date().toISOString() };
    try { await supabasePost('momo_payments', payload); } catch (e) { console.warn('momo: supabase create failed', e.message); }

    if (MOMO_USE_SANDBOX_MOCK) {
      return res.json({ ok: true, reference, status: 'pending', instruction: `MOCK: send *182*... or simulate callback with POST /api/momo/mock/callback` });
    }

    // Placeholder for real provider integration — return informative response
    return res.json({ ok: true, reference, status: 'pending', instruction: 'Real provider mode not implemented in this repo. Configure MOMO client.' });
  } catch (e) { console.error('momo/initiate', e.message); res.status(500).json({ error: e.message }); }
});

// Mock callback to simulate payment provider notifying us — developer only
router.post('/mock/callback', async (req, res) => {
  try {
    const { reference } = req.body || {};
    if (!reference) return res.status(400).json({ error: 'Missing reference' });
    // Mark payment as successful
    try { await supabasePatch('momo_payments', `reference=eq.${encodeURIComponent(reference)}`, { status: 'success', updated_at: new Date().toISOString() }); } catch (e) { console.warn('momo: supabase patch payment failed', e.message); }

    // Lookup payment to patch user
    try {
      const rows = await fetch(`${SUPABASE_URL}/rest/v1/momo_payments?reference=eq.${encodeURIComponent(reference)}&select=user_phone,amount,plan`).then(r => r.json());
      const p = rows && rows[0];
      if (p && p.user_phone) {
        // Approve user's subscription
        const planData = { subscription_plan: p.plan || 'ubuntu', subscription_plan_name: (p.plan && p.plan.name) || 'Paid Plan', subscription_amount: p.amount || 0, subscription_status: 'approved', subscription_paid_at: new Date().toISOString(), pending_upgrade: null };
        try { await supabasePatch('users', `phone=eq.${encodeURIComponent(p.user_phone)}`, planData); } catch (e) { console.warn('momo: supabase patch user failed', e.message); }
      }
    } catch (e) { console.warn('momo: lookup payment failed', e.message); }

    res.json({ ok: true, reference, status: 'success' });
  } catch (e) { console.error('momo/mock/callback', e.message); res.status(500).json({ error: e.message }); }
});

// Provider callback (expects { reference, status }) — permissive
router.post('/callback', async (req, res) => {
  try {
    const { reference, status } = req.body || {};
    if (!reference || !status) return res.status(400).json({ error: 'Missing reference or status' });
    try { await supabasePatch('momo_payments', `reference=eq.${encodeURIComponent(reference)}`, { status, updated_at: new Date().toISOString() }); } catch (e) { console.warn('momo: supabase patch payment failed', e.message); }
    if (status === 'success') {
      try {
        const rows = await fetch(`${SUPABASE_URL}/rest/v1/momo_payments?reference=eq.${encodeURIComponent(reference)}&select=user_phone,amount,plan`).then(r => r.json());
        const p = rows && rows[0];
        if (p && p.user_phone) {
          const planData = { subscription_plan: p.plan || 'ubuntu', subscription_plan_name: (p.plan && p.plan.name) || 'Paid Plan', subscription_amount: p.amount || 0, subscription_status: 'approved', subscription_paid_at: new Date().toISOString(), pending_upgrade: null };
          try { await supabasePatch('users', `phone=eq.${encodeURIComponent(p.user_phone)}`, planData); } catch (e) { console.warn('momo: supabase patch user failed', e.message); }
        }
      } catch (e) { console.warn('momo: lookup payment failed', e.message); }
    }
    res.json({ ok: true });
  } catch (e) { console.error('momo/callback', e.message); res.status(500).json({ error: e.message }); }
});

export default router;
