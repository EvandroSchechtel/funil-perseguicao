-- Add ultima_varredura_at to campanhas
-- Used as a 24h lock to prevent repeated group scans

ALTER TABLE "campanhas" ADD COLUMN "ultima_varredura_at" TIMESTAMPTZ;
