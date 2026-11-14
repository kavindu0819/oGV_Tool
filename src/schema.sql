-- oGV Project Finder schema. Runs on every server start; safe to run again.

-- One row per project. A project can run several times (see project_slots).
CREATE TABLE IF NOT EXISTS projects (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product        ENUM('on_the_map', 'global_classroom', 'skill_up') NOT NULL,
  name           VARCHAR(160) NOT NULL,
  sdg            TINYINT UNSIGNED NULL,
  country        VARCHAR(80)  NOT NULL,
  host_lc        VARCHAR(120) NOT NULL,
  city           VARCHAR(80)  NULL,
  duration_weeks TINYINT UNSIGNED NOT NULL,
  project_link   VARCHAR(500) NOT NULL,
  booklet_link   VARCHAR(500) NULL,
  covered        VARCHAR(255) NULL,
  language       VARCHAR(120) NULL,
  notes          TEXT NULL,
  added_by       VARCHAR(80)  NULL,
  is_closed      TINYINT(1)   NOT NULL DEFAULT 0,
  last_checked   DATE NOT NULL,
  -- NULL for real projects. Set for projects added through the demo login:
  -- CR sees them with a "Demo" tag, and only that demo visitor can edit them.
  demo_session   CHAR(32) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_projects_search (product, country, is_closed),
  INDEX idx_projects_demo (demo_session, created_at)
);

-- Each start date of a project. CR searches by the month a slot starts.
CREATE TABLE IF NOT EXISTS project_slots (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id  INT UNSIGNED NOT NULL,
  start_date  DATE NOT NULL,
  CONSTRAINT fk_slots_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_slots_start (start_date)
);

-- Logged by CR when a search finds nothing, so IR knows what to look for.
CREATE TABLE IF NOT EXISTS project_requests (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product       ENUM('on_the_map', 'global_classroom', 'skill_up') NOT NULL,
  country       VARCHAR(80) NULL,
  month         CHAR(7) NULL,            -- 'YYYY-MM', NULL means any month
  ep_count      TINYINT UNSIGNED NOT NULL DEFAULT 1,
  requested_by  VARCHAR(80) NOT NULL,
  note          VARCHAR(500) NULL,
  status        ENUM('open', 'found') NOT NULL DEFAULT 'open',
  demo_session  CHAR(32) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_requests_status (status, created_at)
);
