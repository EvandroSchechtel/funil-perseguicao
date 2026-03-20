-- CreateTable: demanda_eventos (activity log)
CREATE TABLE "demanda_eventos" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "demanda_id"  TEXT         NOT NULL,
    "tipo"        VARCHAR(50)  NOT NULL,
    "descricao"   TEXT         NOT NULL,
    "usuario_id"  TEXT,
    "meta"        JSONB,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "demanda_eventos_pkey" PRIMARY KEY ("id")
);

-- Index for fast per-demand queries
CREATE INDEX "demanda_eventos_demanda_id_created_at_idx"
    ON "demanda_eventos" ("demanda_id", "created_at");

-- Foreign keys
ALTER TABLE "demanda_eventos"
    ADD CONSTRAINT "demanda_eventos_demanda_id_fkey"
    FOREIGN KEY ("demanda_id") REFERENCES "demandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "demanda_eventos"
    ADD CONSTRAINT "demanda_eventos_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
