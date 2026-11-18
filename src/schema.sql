-- oGV Project Finder schema (PostgreSQL). Runs on start; safe to run again.

-- One row per project. A project can run several times (see project_slots).
CREATE TABLE IF NOT EXISTS projects (
  id             SERIAL PRIMARY KEY,
  product        TEXT NOT NULL CHECK (product IN ('on_the_map', 'global_classroom', 'skill_up')),
  name           VARCHAR(160) NOT NULL,
  sdg            SMALLINT NULL,
  country        VARCHAR(80)  NOT NULL,
  host_lc        VARCHAR(120) NOT NULL,
  city           VARCHAR(80)  NULL,
  duration_weeks SMALLINT NOT NULL,
  project_link   VARCHAR(500) NOT NULL,
  booklet_link   VARCHAR(500) NULL,
  covered        VARCHAR(255) NULL,
  language       VARCHAR(120) NULL,
  notes          TEXT NULL,
  added_by       VARCHAR(80)  NULL,
  is_closed      SMALLINT NOT NULL DEFAULT 0,
  last_checked   DATE NOT NULL,
  -- NULL for real projects. Set for projects added through the demo login:
  -- CR sees them with a "Demo" tag, and only that demo visitor can edit them.
  demo_session   CHAR(32) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Set by the app on every UPDATE (Postgres has no ON UPDATE clause).
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_projects_search ON projects (product, country, is_closed);
CREATE INDEX IF NOT EXISTS idx_projects_demo ON projects (demo_session, created_at);

-- Each start date of a project. CR searches by the month a slot starts.
CREATE TABLE IF NOT EXISTS project_slots (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slots_start ON project_slots (start_date);
CREATE INDEX IF NOT EXISTS idx_slots_project ON project_slots (project_id);

-- Fields a project suits (mainly Skill Up), e.g. "Computer sciences", "Architecture".
-- One row per field, so a project can have several and CR can filter by one.
CREATE TABLE IF NOT EXISTS project_fields (
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field       VARCHAR(80) NOT NULL,
  PRIMARY KEY (project_id, field)
);
CREATE INDEX IF NOT EXISTS idx_fields_field ON project_fields (field);

-- Logged by CR when a search finds nothing, so IR knows what to look for.
CREATE TABLE IF NOT EXISTS project_requests (
  id            SERIAL PRIMARY KEY,
  product       TEXT NOT NULL CHECK (product IN ('on_the_map', 'global_classroom', 'skill_up')),
  country       VARCHAR(80) NULL,
  month         CHAR(7) NULL,            -- 'YYYY-MM', NULL means any month
  ep_count      SMALLINT NOT NULL DEFAULT 1,
  requested_by  VARCHAR(80) NOT NULL,
  note          VARCHAR(500) NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'found')),
  demo_session  CHAR(32) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON project_requests (status, created_at);
