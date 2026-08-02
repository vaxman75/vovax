-- Tasks (replaces window.storage key 'personal-core-tasks')
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('active', 'waiting', 'someday', 'done')),
  added_at BIGINT NOT NULL,
  completed_at BIGINT
);

-- Board meetings (replaces 'board-meetings')
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  decisions JSONB DEFAULT '[]',
  created_at BIGINT NOT NULL
);

-- Ops board items (replaces 'company-ops-board')
CREATE TABLE IF NOT EXISTS ops_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  owner TEXT,
  notes TEXT,
  created_at BIGINT NOT NULL
);

-- Gigs / performances (replaces 'performances-board')
CREATE TABLE IF NOT EXISTS gigs (
  id TEXT PRIMARY KEY,
  venue TEXT NOT NULL,
  date TEXT NOT NULL,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'inquiry',
  notes TEXT,
  created_at BIGINT NOT NULL
);

-- Per-tool settings (stores config, never raw API keys to client)
CREATE TABLE IF NOT EXISTS tool_settings (
  tool TEXT PRIMARY KEY,
  settings JSONB NOT NULL DEFAULT '{}'
);
