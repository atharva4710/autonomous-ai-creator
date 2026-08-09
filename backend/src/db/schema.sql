-- PostgreSQL Schema & Migrations for Autonomous AI Creator

CREATE TABLE IF NOT EXISTS agents (
  agent_id VARCHAR(255) PRIMARY KEY,
  persona JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'INITIALIZED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_cycle_at TIMESTAMPTZ,
  last_published_at TIMESTAMPTZ,
  next_cycle_at TIMESTAMPTZ,
  interval_minutes INT DEFAULT 15
);

CREATE TABLE IF NOT EXISTS topics (
  id VARCHAR(255) PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  source_name TEXT,
  source_url TEXT,
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS editorial_decisions (
  id VARCHAR(255) PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  topic_id VARCHAR(255) UNIQUE NOT NULL,
  decision VARCHAR(50) NOT NULL,
  scores JSONB NOT NULL,
  reason TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrations for existing tables
ALTER TABLE editorial_decisions ADD COLUMN IF NOT EXISTS agent_id VARCHAR(255);
ALTER TABLE editorial_decisions ADD COLUMN IF NOT EXISTS selection_rank INT;
ALTER TABLE editorial_decisions ADD COLUMN IF NOT EXISTS comparative_alternatives JSONB;

CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(255) PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  topic_id VARCHAR(255) NOT NULL,
  decision_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  text TEXT NOT NULL,
  rationale TEXT,
  sources JSONB,
  content JSONB,
  selected_format VARCHAR(50),
  regenerations_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMPTZ
);

-- Migrations for existing tables
ALTER TABLE posts ADD COLUMN IF NOT EXISTS regenerations_count INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS memories (
  id VARCHAR(255) PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  topic_id VARCHAR(255),
  title TEXT,
  summary TEXT,
  source TEXT,
  decision VARCHAR(50),
  score INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_events (
  id VARCHAR(255) PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  topic_id VARCHAR(255),
  post_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_topics_agent_id ON topics(agent_id);
CREATE INDEX IF NOT EXISTS idx_editorial_decisions_agent_id ON editorial_decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_posts_agent_id ON posts(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_agent_id ON activity_events(agent_id);
