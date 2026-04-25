-- ============================================================
-- CF Coach — Supabase Migration: Solve Sessions, Quests, Virtual Profiles
-- Run this in the Supabase SQL Editor to create the required tables.
-- ============================================================

-- Solve Sessions (Live Practice timer data)
CREATE TABLE IF NOT EXISTS solve_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  problem_url TEXT NOT NULL,
  problem_info JSONB,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'abandoned')),
  rating_delta NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solve_sessions_profile ON solve_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_solve_sessions_status ON solve_sessions(profile_id, status);

-- Quests
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  xp_reward INTEGER DEFAULT 0,
  target_date TIMESTAMPTZ,
  related_tags JSONB DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed')),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  assessed_submissions JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quests_profile ON quests(profile_id);
CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(profile_id, status);

-- Virtual Profiles (XP / Leveling)
CREATE TABLE IF NOT EXISTS virtual_profiles (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0,
  quests_completed INTEGER DEFAULT 0,
  quests_failed INTEGER DEFAULT 0,
  streak_multiplier NUMERIC DEFAULT 1.0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (match the existing pattern)
ALTER TABLE solve_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_profiles ENABLE ROW LEVEL SECURITY;

-- Policies: allow all for anon key (matches existing tables)
CREATE POLICY "Allow all for solve_sessions" ON solve_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for quests" ON quests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for virtual_profiles" ON virtual_profiles FOR ALL USING (true) WITH CHECK (true);
