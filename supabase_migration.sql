-- RoadRules Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  district TEXT NOT NULL DEFAULT 'Kigali',
  password_hash TEXT NOT NULL,
  subscription_plan TEXT NOT NULL DEFAULT 'ubuntu',
  subscription_plan_name TEXT NOT NULL DEFAULT 'Ubuntu Free',
  subscription_amount INTEGER NOT NULL DEFAULT 0,
  subscription_status TEXT NOT NULL DEFAULT 'approved',
  subscription_paid_at TIMESTAMPTZ,
  pending_upgrade JSONB,
  seen_announcement_ids TEXT[] DEFAULT '{}',
  chat_progress JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- EXAM HISTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS exam_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL DEFAULT 20,
  time_taken INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_history_user_id ON exam_history(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_history_created_at ON exam_history(created_at DESC);

-- =============================================
-- ANNOUNCEMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements;
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- HELP FAQs TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS help_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_help_faqs_updated_at ON help_faqs;
CREATE TRIGGER update_help_faqs_updated_at
  BEFORE UPDATE ON help_faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- CONFIG TABLE (key-value store for admin settings)
-- =============================================
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default chatbot config
INSERT INTO config (key, value)
VALUES ('chatbot', '{"rugambaProactiveDelayMin": 5}')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- We use service role key server-side, so RLS is a safety net.
-- Disable all public access — only server (service key) can access.
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating
DROP POLICY IF EXISTS "No public access to users" ON users;
DROP POLICY IF EXISTS "No public access to exam_history" ON exam_history;
DROP POLICY IF EXISTS "No public access to announcements" ON announcements;
DROP POLICY IF EXISTS "No public access to help_faqs" ON help_faqs;
DROP POLICY IF EXISTS "No public access to config" ON config;

-- Block all anonymous/public access (service role bypasses RLS)
CREATE POLICY "No public access to users" ON users FOR ALL TO anon USING (false);
CREATE POLICY "No public access to exam_history" ON exam_history FOR ALL TO anon USING (false);
CREATE POLICY "No public access to announcements" ON announcements FOR ALL TO anon USING (false);
CREATE POLICY "No public access to help_faqs" ON help_faqs FOR ALL TO anon USING (false);
CREATE POLICY "No public access to config" ON config FOR ALL TO anon USING (false);

-- Done!
SELECT 'Migration complete. Tables: users, exam_history, announcements, help_faqs, config' AS status;
