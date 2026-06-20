-- RoadRules — Static Site Migration
-- Run this in Supabase SQL Editor AFTER the base migration
-- This adds RPCs so the browser can call Supabase directly (no Express server needed)

-- ============================================================
-- 0. ENABLE pgcrypto (for bcrypt password hashing in SQL)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. AUTH RPCs
-- ============================================================

-- SIGNUP
CREATE OR REPLACE FUNCTION roadrules_signup(
  p_name TEXT, p_phone TEXT, p_district TEXT, p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_user users%ROWTYPE;
BEGIN
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF EXISTS (SELECT 1 FROM users WHERE phone = p_phone) THEN
    RAISE EXCEPTION 'Iyi telefone irahari. Injira!';
  END IF;
  v_hash := crypt(p_password, gen_salt('bf', 10));
  INSERT INTO users (name, phone, district, password_hash,
    subscription_plan, subscription_plan_name, subscription_amount,
    subscription_status, subscription_paid_at)
  VALUES (trim(p_name), p_phone, trim(coalesce(p_district,'Kigali')), v_hash,
    'ubuntu', 'Ubuntu Free', 0, 'approved', now())
  RETURNING * INTO v_user;
  RETURN jsonb_build_object(
    'id', v_user.id,
    'name', v_user.name,
    'phone', v_user.phone,
    'district', v_user.district,
    'subscription', jsonb_build_object(
      'plan', v_user.subscription_plan,
      'planName', v_user.subscription_plan_name,
      'amount', v_user.subscription_amount,
      'status', v_user.subscription_status,
      'paidAt', v_user.subscription_paid_at
    )
  );
END;
$$;

-- LOGIN (handles both $2b$ from bcryptjs and $2a$ from pgcrypto)
CREATE OR REPLACE FUNCTION roadrules_login(p_phone TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_hash TEXT;
BEGIN
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  SELECT * INTO v_user FROM users WHERE phone = p_phone;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Konti ntabwo ibaho. Iyandikishe!';
  END IF;
  -- Normalize $2b$ → $2a$ for pgcrypto compatibility
  v_hash := replace(v_user.password_hash, '$2b$', '$2a$');
  IF crypt(p_password, v_hash) != v_hash THEN
    RAISE EXCEPTION 'Ijambobanga cyangwa nimero si byo.';
  END IF;
  RETURN jsonb_build_object(
    'id', v_user.id,
    'name', v_user.name,
    'phone', v_user.phone,
    'district', v_user.district,
    'subscription', jsonb_build_object(
      'plan', v_user.subscription_plan,
      'planName', v_user.subscription_plan_name,
      'amount', v_user.subscription_amount,
      'status', v_user.subscription_status,
      'paidAt', v_user.subscription_paid_at
    ),
    'pendingUpgrade', v_user.pending_upgrade
  );
END;
$$;

-- REFRESH (get latest plan data by phone)
CREATE OR REPLACE FUNCTION roadrules_refresh(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users%ROWTYPE;
BEGIN
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  SELECT * INTO v_user FROM users WHERE phone = p_phone;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  RETURN jsonb_build_object(
    'id', v_user.id,
    'name', v_user.name,
    'phone', v_user.phone,
    'district', v_user.district,
    'subscription', jsonb_build_object(
      'plan', v_user.subscription_plan,
      'planName', v_user.subscription_plan_name,
      'amount', v_user.subscription_amount,
      'status', v_user.subscription_status,
      'paidAt', v_user.subscription_paid_at
    ),
    'pendingUpgrade', v_user.pending_upgrade
  );
END;
$$;

-- ============================================================
-- 2. USER DATA RPCs (called by logged-in user)
-- ============================================================

-- SAVE EXAM
CREATE OR REPLACE FUNCTION roadrules_save_exam(
  p_phone TEXT, p_score INTEGER, p_total INTEGER, p_time_taken INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID;
BEGIN
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  SELECT id INTO v_uid FROM users WHERE phone = p_phone;
  IF v_uid IS NULL THEN RETURN; END IF;
  INSERT INTO exam_history (user_id, score, total, time_taken)
  VALUES (v_uid, p_score, p_total, coalesce(p_time_taken, 0));
END;
$$;

-- SET PENDING UPGRADE
CREATE OR REPLACE FUNCTION roadrules_set_pending_upgrade(
  p_phone TEXT, p_upgrade JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  UPDATE users SET pending_upgrade = p_upgrade WHERE phone = p_phone;
END;
$$;

-- MARK ANNOUNCEMENTS SEEN
CREATE OR REPLACE FUNCTION roadrules_mark_announcements_seen(
  p_phone TEXT, p_ids TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  UPDATE users SET seen_announcement_ids = p_ids WHERE phone = p_phone;
END;
$$;

-- ============================================================
-- 3. ADMIN RPCs (all require admin password)
-- ============================================================

-- Helper: verify admin password (stored as bcrypt hash in config)
CREATE OR REPLACE FUNCTION _rr_admin_ok(p_pwd TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT (value->>'hash') INTO v_hash FROM config WHERE key = 'admin_auth';
  IF v_hash IS NULL THEN
    -- First time: accept default password and set hash
    IF p_pwd = 'perime_admin_2026' THEN
      INSERT INTO config (key, value)
      VALUES ('admin_auth', jsonb_build_object('hash', crypt('perime_admin_2026', gen_salt('bf', 10))))
      ON CONFLICT (key) DO UPDATE SET value = excluded.value;
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;
  RETURN crypt(p_pwd, replace(v_hash, '$2b$', '$2a$')) = replace(v_hash, '$2b$', '$2a$');
END;
$$;

-- LIST ALL USERS
CREATE OR REPLACE FUNCTION roadrules_admin_list_users(p_admin_pwd TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'id', u.id, 'name', u.name, 'phone', u.phone, 'district', u.district,
      'createdAt', u.created_at, 'lastUpdated', u.updated_at,
      'subscription', jsonb_build_object(
        'plan', u.subscription_plan, 'planName', u.subscription_plan_name,
        'amount', u.subscription_amount, 'status', u.subscription_status,
        'paidAt', u.subscription_paid_at
      ),
      'pendingUpgrade', u.pending_upgrade
    ) ORDER BY u.created_at DESC)
    FROM users u
  );
END;
$$;

-- GET USER
CREATE OR REPLACE FUNCTION roadrules_admin_get_user(p_admin_pwd TEXT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user users%ROWTYPE;
  v_exams JSONB;
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  SELECT * INTO v_user FROM users WHERE phone = p_phone;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  SELECT jsonb_agg(jsonb_build_object('score', score, 'total', total, 'timeTaken', time_taken, 'date', created_at) ORDER BY created_at DESC)
  INTO v_exams FROM exam_history WHERE user_id = v_user.id;
  RETURN jsonb_build_object(
    'id', v_user.id, 'name', v_user.name, 'phone', v_user.phone, 'district', v_user.district,
    'createdAt', v_user.created_at, 'lastUpdated', v_user.updated_at,
    'subscription', jsonb_build_object(
      'plan', v_user.subscription_plan, 'planName', v_user.subscription_plan_name,
      'amount', v_user.subscription_amount, 'status', v_user.subscription_status,
      'paidAt', v_user.subscription_paid_at
    ),
    'pendingUpgrade', v_user.pending_upgrade,
    'exams', coalesce(v_exams, '[]'::jsonb)
  );
END;
$$;

-- APPROVE USER PLAN
CREATE OR REPLACE FUNCTION roadrules_admin_approve(p_admin_pwd TEXT, p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending JSONB;
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  SELECT pending_upgrade INTO v_pending FROM users WHERE phone = p_phone;
  UPDATE users SET
    subscription_plan = coalesce(v_pending->>'plan', subscription_plan),
    subscription_plan_name = coalesce(v_pending->>'planName', subscription_plan_name),
    subscription_amount = coalesce((v_pending->>'amount')::int, subscription_amount),
    subscription_status = 'approved',
    subscription_paid_at = now(),
    pending_upgrade = NULL
  WHERE phone = p_phone;
END;
$$;

-- REJECT PENDING UPGRADE
CREATE OR REPLACE FUNCTION roadrules_admin_reject(p_admin_pwd TEXT, p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  UPDATE users SET pending_upgrade = NULL WHERE phone = p_phone;
END;
$$;

-- DISMISS (reset to ubuntu free)
CREATE OR REPLACE FUNCTION roadrules_admin_dismiss(p_admin_pwd TEXT, p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  UPDATE users SET
    subscription_plan = 'ubuntu', subscription_plan_name = 'Ubuntu Free',
    subscription_amount = 0, subscription_status = 'approved',
    subscription_paid_at = now(), pending_upgrade = NULL
  WHERE phone = p_phone;
END;
$$;

-- DELETE SINGLE EXAM
CREATE OR REPLACE FUNCTION roadrules_delete_exam(p_phone TEXT, p_exam_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID;
BEGIN
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  SELECT id INTO v_uid FROM users WHERE phone = p_phone;
  IF v_uid IS NOT NULL THEN
    DELETE FROM exam_history WHERE user_id = v_uid AND id = p_exam_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION roadrules_delete_exam TO anon;

-- DELETE EXAM HISTORY
CREATE OR REPLACE FUNCTION roadrules_delete_exam_history(p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID;
BEGIN
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  SELECT id INTO v_uid FROM users WHERE phone = p_phone;
  IF v_uid IS NOT NULL THEN
    DELETE FROM exam_history WHERE user_id = v_uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION roadrules_delete_exam_history TO anon;

-- DELETE USER
CREATE OR REPLACE FUNCTION roadrules_admin_delete_user(p_admin_pwd TEXT, p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  p_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  DELETE FROM users WHERE phone = p_phone;
END;
$$;

-- POST ANNOUNCEMENT
CREATE OR REPLACE FUNCTION roadrules_admin_post_announcement(
  p_admin_pwd TEXT, p_title TEXT, p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row announcements%ROWTYPE;
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  INSERT INTO announcements (title, content) VALUES (trim(p_title), trim(p_content)) RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- EDIT ANNOUNCEMENT
CREATE OR REPLACE FUNCTION roadrules_admin_edit_announcement(
  p_admin_pwd TEXT, p_id UUID, p_title TEXT, p_content TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  UPDATE announcements SET
    title = coalesce(p_title, title),
    content = coalesce(p_content, content),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

-- DELETE ANNOUNCEMENT
CREATE OR REPLACE FUNCTION roadrules_admin_delete_announcement(p_admin_pwd TEXT, p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  DELETE FROM announcements WHERE id = p_id;
END;
$$;

-- POST HELP FAQ
CREATE OR REPLACE FUNCTION roadrules_admin_post_faq(
  p_admin_pwd TEXT, p_question TEXT, p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row help_faqs%ROWTYPE;
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  INSERT INTO help_faqs (question, answers) VALUES (trim(p_question), p_answers) RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- EDIT HELP FAQ
CREATE OR REPLACE FUNCTION roadrules_admin_edit_faq(
  p_admin_pwd TEXT, p_id UUID, p_question TEXT, p_answers JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  UPDATE help_faqs SET
    question = coalesce(p_question, question),
    answers = coalesce(p_answers, answers),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

-- DELETE HELP FAQ
CREATE OR REPLACE FUNCTION roadrules_admin_delete_faq(p_admin_pwd TEXT, p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  DELETE FROM help_faqs WHERE id = p_id;
END;
$$;

-- UPDATE CHATBOT CONFIG
CREATE OR REPLACE FUNCTION roadrules_admin_update_chatbot_config(
  p_admin_pwd TEXT, p_partial JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current JSONB;
  v_merged JSONB;
BEGIN
  IF NOT _rr_admin_ok(p_admin_pwd) THEN RAISE EXCEPTION 'ADMIN_AUTH_FAILED'; END IF;
  SELECT value INTO v_current FROM config WHERE key = 'chatbot';
  v_current := coalesce(v_current, '{"rugambaProactiveDelayMin": 5}'::jsonb);
  v_merged := v_current || p_partial;
  INSERT INTO config (key, value) VALUES ('chatbot', v_merged)
  ON CONFLICT (key) DO UPDATE SET value = v_merged;
  RETURN v_merged;
END;
$$;

-- ============================================================
-- 4. UPDATE RLS — allow anon to READ public tables
--    (RPCs bypass RLS via SECURITY DEFINER)
-- ============================================================

-- Drop old block-all anon policies
DROP POLICY IF EXISTS "No public access to announcements" ON announcements;
DROP POLICY IF EXISTS "No public access to help_faqs" ON help_faqs;
DROP POLICY IF EXISTS "No public access to config" ON config;

-- Allow anyone to read announcements, FAQs, chatbot config
CREATE POLICY "anon_read_announcements" ON announcements FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_help_faqs" ON help_faqs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_config" ON config FOR SELECT TO anon USING (true);

-- users and exam_history remain blocked for direct anon access (RPCs handle everything)

-- ============================================================
-- 5. GRANT RPC EXECUTE to anon role
-- ============================================================
GRANT EXECUTE ON FUNCTION roadrules_signup TO anon;
GRANT EXECUTE ON FUNCTION roadrules_login TO anon;
GRANT EXECUTE ON FUNCTION roadrules_refresh TO anon;
GRANT EXECUTE ON FUNCTION roadrules_save_exam TO anon;
GRANT EXECUTE ON FUNCTION roadrules_set_pending_upgrade TO anon;
GRANT EXECUTE ON FUNCTION roadrules_mark_announcements_seen TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_list_users TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_get_user TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_approve TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_reject TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_dismiss TO anon;
GRANT EXECUTE ON FUNCTION roadrules_delete_exam TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_delete_user TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_post_announcement TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_edit_announcement TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_delete_announcement TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_post_faq TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_edit_faq TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_delete_faq TO anon;
GRANT EXECUTE ON FUNCTION roadrules_admin_update_chatbot_config TO anon;

SELECT 'Static site migration complete. Default admin password: perime_admin_2026' AS status;
