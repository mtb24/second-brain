CREATE TABLE IF NOT EXISTS tournament_strategies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  generation    INTEGER NOT NULL DEFAULT 0,
  tier          TEXT NOT NULL CHECK (tier IN ('conservative', 'balanced', 'aggressive')),
  status        TEXT NOT NULL DEFAULT 'approved'
                  CHECK (status IN ('proposed','approved','active','retired','hall_of_fame')),
  source        TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual','master','bred','mutated')),
  parent_ids    UUID[] NOT NULL DEFAULT '{}',
  doc           TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_rounds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','running','complete','aborted')),
  duration_seconds  INTEGER NOT NULL DEFAULT 10800,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_bots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  round_id          UUID REFERENCES tournament_rounds(id),
  strategy_id       UUID REFERENCES tournament_strategies(id),
  status            TEXT NOT NULL DEFAULT 'idle'
                      CHECK (status IN ('idle','running','finished','error')),
  starting_balance  NUMERIC(12,2) NOT NULL DEFAULT 1000.00,
  final_balance     NUMERIC(12,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_ticks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id      UUID NOT NULL REFERENCES tournament_rounds(id),
  bot_id        UUID NOT NULL REFERENCES tournament_bots(id),
  strategy_id   UUID NOT NULL REFERENCES tournament_strategies(id),
  strategy_name TEXT NOT NULL,
  balance       NUMERIC(14,4) NOT NULL,
  pnl           NUMERIC(14,4) NOT NULL DEFAULT 0,
  pnl_percent   NUMERIC(10,6) NOT NULL DEFAULT 0,
  tick_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tournament_ticks_round_id_idx ON tournament_ticks(round_id);
CREATE INDEX IF NOT EXISTS tournament_ticks_tick_at_idx  ON tournament_ticks(tick_at);

CREATE TABLE IF NOT EXISTS tournament_performance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          UUID NOT NULL REFERENCES tournament_bots(id),
  round_id        UUID NOT NULL REFERENCES tournament_rounds(id),
  strategy_id     UUID NOT NULL REFERENCES tournament_strategies(id),
  pnl             NUMERIC(12,2),
  pnl_percent     NUMERIC(8,4),
  max_drawdown    NUMERIC(8,4),
  total_trades    INTEGER NOT NULL DEFAULT 0,
  winning_trades  INTEGER NOT NULL DEFAULT 0,
  win_rate        NUMERIC(5,4),
  sharpe_ratio    NUMERIC(8,4),
  fitness_score   NUMERIC(8,4),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
