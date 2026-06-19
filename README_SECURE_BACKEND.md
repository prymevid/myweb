**Secure Backend Migration (summary)**

- Remove Google OAuth client secrets and refresh tokens from client-side code. (Done: `auth.js` updated.)
- Run a backend server to hold master credentials as environment variables and proxy Drive calls.
- Quick steps:
  1. Copy `.env.example` to `.env` and fill `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`.
  2. Install dependencies:

```bash
cd c:\web\myweb
npm install
```

  3. Start server in development:

```bash
npm run dev
```

  4. Serve your static site (or run alongside your existing static server). Client now calls `/api/*` endpoints.

Notes:
- Rotate/revoke the old credentials in Google Cloud Console immediately.
- This is a minimal example. For production, add authentication for users (session cookies or JWT), rate limiting, input validation, and logging.
