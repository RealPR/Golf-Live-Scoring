-- ============================================================
-- GOLF LIVESCORING — Supabase Schema
-- Führe dieses SQL im Supabase SQL Editor aus
-- ============================================================

-- 1. Tabelle erstellen
CREATE TABLE IF NOT EXISTS scores (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player     TEXT    NOT NULL,
  day        INT     NOT NULL CHECK (day BETWEEN 1 AND 4),
  hole       INT     NOT NULL CHECK (hole BETWEEN 1 AND 18),
  strokes    INT     NOT NULL CHECK (strokes BETWEEN 1 AND 15),
  par        INT     NOT NULL CHECK (par BETWEEN 3 AND 5),
  points     INT     NOT NULL CHECK (points BETWEEN 0 AND 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Jeder Spieler hat pro Tag und Loch nur einen Eintrag
  UNIQUE (player, day, hole)
);

-- 2. Index für schnelle Leaderboard-Abfragen
CREATE INDEX idx_scores_day    ON scores (day);
CREATE INDEX idx_scores_player ON scores (player);

-- 3. Row Level Security — öffentlicher Zugriff (kein Login nötig)
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jeder kann Scores lesen"
  ON scores FOR SELECT
  USING (true);

CREATE POLICY "Jeder kann Scores einfügen"
  ON scores FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Jeder kann Scores aktualisieren"
  ON scores FOR UPDATE
  USING (true);

CREATE POLICY "Jeder kann Scores löschen"
  ON scores FOR DELETE
  USING (true);

-- 4. Realtime aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE scores;

-- 5. Updated_at Trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW
  EXECUTE FUNCTION update_modified_column();
