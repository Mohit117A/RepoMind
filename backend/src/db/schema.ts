export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS repositories (
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  last_fetched_at TEXT NOT NULL,
  is_truncated INTEGER NOT NULL DEFAULT 0,
  pr_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner, repo)
);

CREATE TABLE IF NOT EXISTS records (
  id TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  type TEXT NOT NULL,
  github_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  PRIMARY KEY (id),
  UNIQUE (repo_owner, repo_name, id)
);

CREATE TABLE IF NOT EXISTS record_relationships (
  parent_record_id TEXT NOT NULL,
  child_record_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  PRIMARY KEY (parent_record_id, child_record_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (record_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS embeddings (
  chunk_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  vector_json TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  PRIMARY KEY (chunk_id),
  FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_records_repo ON records(repo_owner, repo_name);
CREATE INDEX IF NOT EXISTS idx_chunks_repo ON chunks(repo_owner, repo_name);
`;
