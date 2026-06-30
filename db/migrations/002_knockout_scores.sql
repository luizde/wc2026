-- db/migrations/002_knockout_scores.sql
-- Separates 90-min score (used for scoring) from extra-time and penalty
-- shootout results (used for display only).
--
-- home_score / away_score now always store the 90-minute result.
-- home_score_et / away_score_et store goals scored *in* extra time only
--   (additive, not cumulative; 0 if ET was played but no goals scored).
-- home_score_pens / away_score_pens store the penalty shootout result.
-- score_duration mirrors football-data.org's score.duration field:
--   'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | NULL for unfinished.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS home_score_et   INTEGER,
  ADD COLUMN IF NOT EXISTS away_score_et   INTEGER,
  ADD COLUMN IF NOT EXISTS home_score_pens INTEGER,
  ADD COLUMN IF NOT EXISTS away_score_pens INTEGER,
  ADD COLUMN IF NOT EXISTS score_duration  TEXT;
