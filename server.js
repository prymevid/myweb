import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 5000;

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
}

requireEnv('CLIENT_ID');
requireEnv('CLIENT_SECRET');
requireEnv('REFRESH_TOKEN');

// Exchange refresh token for access token
app.post('/api/token', async (req, res) => {
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token: process.env.REFRESH_TOKEN
    });
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).send(text);
    }
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send('token error');
  }
});

// Helper: call Drive API with server-held credentials
async function driveRequest(path, opts = {}) {
  // Obtain access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token: process.env.REFRESH_TOKEN
    })
  });
  if (!tokenRes.ok) throw new Error('token fetch failed');
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const headers = Object.assign({}, opts.headers || {}, { Authorization: `Bearer ${accessToken}` });
  const r = await fetch(`https://www.googleapis.com${path}`, Object.assign({}, opts, { headers }));
  return r;
}

// GET folder by name
app.get('/api/drive/folder', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).send('missing name');
  try {
    const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const r = await driveRequest(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`);
    const data = await r.json();
    const id = data.files && data.files.length ? data.files[0].id : null;
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).send('drive error');
  }
});

// POST create folder
app.post('/api/drive/folder', async (req, res) => {
  const name = req.body && req.body.name;
  if (!name) return res.status(400).send('missing name');
  try {
    const r = await driveRequest('/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' })
    });
    const data = await r.json();
    res.json({ id: data.id, raw: data });
  } catch (e) {
    console.error(e);
    res.status(500).send('drive error');
  }
});

// GET find file by name in folder
app.get('/api/drive/find', async (req, res) => {
  const { folderId, fileName } = req.query;
  if (!folderId || !fileName) return res.status(400).send('missing params');
  try {
    const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const r = await driveRequest(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`);
    const data = await r.json();
    const id = data.files && data.files.length ? data.files[0].id : null;
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).send('drive error');
  }
});

// POST create file (JSON) in folder
app.post('/api/drive/files', async (req, res) => {
  const { folderId, userData } = req.body || {};
  if (!folderId || !userData) return res.status(400).send('missing body');
  try {
    const fileName = `${(userData.phone || '').replace(/[^0-9]/g, '')}.json`;
    // Use multipart upload
    const metadata = { name: fileName, parents: [folderId], mimeType: 'application/json' };
    const boundary = '-------nodemultipart' + Date.now();
    const bodyParts = [];
    bodyParts.push(`--${boundary}`);
    bodyParts.push('Content-Type: application/json; charset=UTF-8');
    bodyParts.push('');
    bodyParts.push(JSON.stringify(metadata));
    bodyParts.push(`--${boundary}`);
    bodyParts.push('Content-Type: application/json');
    bodyParts.push('');
    bodyParts.push(JSON.stringify(userData));
    bodyParts.push(`--${boundary}--`);
    const body = bodyParts.join('\r\n');

    const r = await driveRequest(`/upload/drive/v3/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send('drive error');
  }
});

// GET file content
app.get('/api/drive/files/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  try {
    const r = await driveRequest(`/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
    if (!r.ok) return res.status(r.status).send(await r.text());
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).send('drive error');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on ${PORT}`);
});
