-- db/migrations/001_initial.sql

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invite_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT UNIQUE NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  INTEGER UNIQUE NOT NULL,
  home_team    TEXT NOT NULL,
  away_team    TEXT NOT NULL,
  home_crest   TEXT,
  away_crest   TEXT,
  stage        TEXT NOT NULL,
  group_name   TEXT,
  matchday     INTEGER,
  kickoff_utc  TIMESTAMPTZ NOT NULL,
  deadline_utc TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'SCHEDULED',
  home_score   INTEGER,
  away_score   INTEGER,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE predictions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  points     INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

CREATE TABLE sync_meta (
  id             INTEGER PRIMARY KEY DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO sync_meta (id) VALUES (1);

CREATE INDEX predictions_user_id_idx ON predictions(user_id);
CREATE INDEX predictions_match_id_idx ON predictions(match_id);
CREATE INDEX matches_stage_idx ON matches(stage);
CREATE INDEX matches_status_idx ON matches(status);
