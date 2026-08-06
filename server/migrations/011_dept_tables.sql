-- Dept tables: production, sales pipeline, avovax label, website, security, hiring, decisions
CREATE TABLE IF NOT EXISTS production_queue (
  id          SERIAL PRIMARY KEY,
  track_id    INTEGER,
  title       TEXT NOT NULL,
  stage       TEXT NOT NULL DEFAULT 'mix' CHECK (stage IN ('mix','master','done')),
  assigned_to TEXT,
  notes       TEXT,
  created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT,
  updated_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS sales_pipeline (
  id          SERIAL PRIMARY KEY,
  prospect    TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'label' CHECK (type IN ('label','booking','sync','other')),
  stage       TEXT NOT NULL DEFAULT 'contacted' CHECK (stage IN ('prospect','contacted','replied','negotiating','offer_sent','closed','lost')),
  assigned_to TEXT,
  notes       TEXT,
  created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT,
  updated_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS label_catalog (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  artist       TEXT,
  release_date TEXT,
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','released','shelved')),
  platforms    TEXT,
  notes        TEXT,
  created_at   BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS website_tasks (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done')),
  priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  notes       TEXT,
  created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT,
  updated_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS security_log (
  id          SERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL,
  description TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  source      TEXT,
  created_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS hiring_log (
  id          SERIAL PRIMARY KEY,
  candidate   TEXT NOT NULL,
  role        TEXT NOT NULL,
  dept        TEXT,
  stage       TEXT NOT NULL DEFAULT 'applied' CHECK (stage IN ('applied','screening','interview','offer','hired','rejected')),
  notes       TEXT,
  applied_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT,
  updated_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT
);

CREATE TABLE IF NOT EXISTS decisions_log (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  decision    TEXT NOT NULL,
  decided_by  TEXT,
  scope       TEXT DEFAULT 'company' CHECK (scope IN ('company','dept','product')),
  notes       TEXT,
  decided_at  BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT
);
