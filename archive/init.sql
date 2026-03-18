-- =============================================================
-- Second Brain — OB1 Database Schema
-- Runs once on first Postgres container start
-- =============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------
-- Core thoughts table (OB1-compatible)
-- All domains write here. domain_tag scopes each entry.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS thoughts (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content       TEXT NOT NULL,
    domain_tag    TEXT NOT NULL CHECK (domain_tag IN (
                    'note', 'code', 'recipe', 'task',
                    'bookmark', 'journal', 'trading_research'
                  )),
    source        TEXT,                        -- 'ios_voice', 'web', 'agent', etc.
    metadata      JSONB DEFAULT '{}',
    embedding     vector(768),                 -- nomic-embed-text dimension
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- Cross-domain links (explicit only — never automatic)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS thought_links (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_id       UUID REFERENCES thoughts(id) ON DELETE CASCADE,
    to_id         UUID REFERENCES thoughts(id) ON DELETE CASCADE,
    link_type     TEXT NOT NULL,               -- 'related', 'inspired_by', 'contradicts'
    created_by    TEXT NOT NULL,               -- 'user' or agent name
    note          TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_id, to_id, link_type)
);

-- -----------------------------------------------------------
-- Strategy lineage (trading tournament)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS strategies (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    code          TEXT NOT NULL,
    parent_id     UUID REFERENCES strategies(id),
    generation    INTEGER DEFAULT 1,
    bracket       INTEGER DEFAULT 1 CHECK (bracket IN (1, 2, 3)),
    status        TEXT DEFAULT 'active' CHECK (status IN (
                    'active', 'frozen', 'champion'
                  )),
    params        JSONB DEFAULT '{}',
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id     UUID REFERENCES strategies(id) ON DELETE CASCADE,
    bracket         INTEGER NOT NULL,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    virtual_capital NUMERIC DEFAULT 1000,
    final_value     NUMERIC,
    return_pct      NUMERIC,
    sharpe_ratio    NUMERIC,
    max_drawdown    NUMERIC,
    win_rate        NUMERIC,
    total_trades    INTEGER DEFAULT 0,
    outcome         TEXT CHECK (outcome IN ('advanced', 'frozen', 'running'))
);

-- -----------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS thoughts_domain_idx ON thoughts(domain_tag);
CREATE INDEX IF NOT EXISTS thoughts_created_idx ON thoughts(created_at DESC);
CREATE INDEX IF NOT EXISTS thoughts_embedding_idx ON thoughts
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS strategies_status_idx ON strategies(status);
CREATE INDEX IF NOT EXISTS strategies_bracket_idx ON strategies(bracket);
CREATE INDEX IF NOT EXISTS strategy_runs_strategy_idx ON strategy_runs(strategy_id);

-- -----------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thoughts_updated_at
    BEFORE UPDATE ON thoughts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
