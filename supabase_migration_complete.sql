-- ============================================================
-- CF Coach — COMPLETE Supabase Migration
-- Run this in the Supabase SQL Editor to create ALL required tables.
-- This is idempotent (safe to run multiple times).
-- ============================================================

-- 1. Profiles (base table — all others reference this)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cf_handle TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(cf_handle);

-- 2. Analyses (Mentor analysis cache)
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  time_range TEXT NOT NULL,
  analysis_data JSONB NOT NULL,
  submissions_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, time_range)
);

CREATE INDEX IF NOT EXISTS idx_analyses_profile ON analyses(profile_id);

-- 3. Progress Snapshots
CREATE TABLE IF NOT EXISTS progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  rating INTEGER,
  problems_solved INTEGER,
  tags_practiced JSONB,
  difficulty_range TEXT,
  streak_days INTEGER,
  snapshot_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_progress_profile ON progress_snapshots(profile_id);

-- 4. Ladders
CREATE TABLE IF NOT EXISTS ladders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  problems JSONB,
  target_tags JSONB,
  difficulty_range TEXT,
  total_problems INTEGER,
  completed_problems INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ladders_profile ON ladders(profile_id);

-- 5. Mentor Memory
CREATE TABLE IF NOT EXISTS mentor_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_memory_profile ON mentor_memory(profile_id);

-- 6. Review Items (Spaced Repetition)
CREATE TABLE IF NOT EXISTS review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  problem_name TEXT,
  problem_rating INTEGER,
  tags JSONB,
  mastery_level TEXT,
  ease_factor NUMERIC DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  next_review TIMESTAMPTZ,
  last_reviewed TIMESTAMPTZ,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_items_profile ON review_items(profile_id);

-- 7. API Usage Tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  calls_made INTEGER DEFAULT 0,
  calls_limit INTEGER DEFAULT 20,
  UNIQUE(profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_profile ON api_usage(profile_id);

-- 8. Solve Sessions (Live Practice timer data)
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

-- 9. Quests
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

-- 10. Virtual Profiles (XP / Leveling)
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

-- ============================================================
-- Row Level Security — allow all for anon key
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ladders ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE solve_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DO $$ BEGIN
  -- Profiles
  DROP POLICY IF EXISTS "Allow all for profiles" ON profiles;
  -- Analyses
  DROP POLICY IF EXISTS "Allow all for analyses" ON analyses;
  -- Progress snapshots
  DROP POLICY IF EXISTS "Allow all for progress_snapshots" ON progress_snapshots;
  -- Ladders
  DROP POLICY IF EXISTS "Allow all for ladders" ON ladders;
  -- Mentor memory
  DROP POLICY IF EXISTS "Allow all for mentor_memory" ON mentor_memory;
  -- Review items
  DROP POLICY IF EXISTS "Allow all for review_items" ON review_items;
  -- API usage
  DROP POLICY IF EXISTS "Allow all for api_usage" ON api_usage;
  -- Solve sessions
  DROP POLICY IF EXISTS "Allow all for solve_sessions" ON solve_sessions;
  -- Quests
  DROP POLICY IF EXISTS "Allow all for quests" ON quests;
  -- Virtual profiles
  DROP POLICY IF EXISTS "Allow all for virtual_profiles" ON virtual_profiles;
END $$;

CREATE POLICY "Allow all for profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for analyses" ON analyses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for progress_snapshots" ON progress_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for ladders" ON ladders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for mentor_memory" ON mentor_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for review_items" ON review_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for api_usage" ON api_usage FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for solve_sessions" ON solve_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for quests" ON quests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for virtual_profiles" ON virtual_profiles FOR ALL USING (true) WITH CHECK (true);
