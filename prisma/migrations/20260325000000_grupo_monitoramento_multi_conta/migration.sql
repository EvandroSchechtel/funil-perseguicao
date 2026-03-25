-- CreateTable: grupos_monitoramento_contas
-- Junction table allowing multiple Manychat accounts per monitored group

CREATE TABLE "grupos_monitoramento_contas" (
  "id" TEXT NOT NULL,
  "grupo_id" TEXT NOT NULL,
  "conta_manychat_id" TEXT NOT NULL,
  "tag_manychat_id" INTEGER NOT NULL,
  "tag_manychat_nome" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "grupos_monitoramento_contas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "grupos_monitoramento_contas_grupo_id_fkey"
    FOREIGN KEY ("grupo_id") REFERENCES "grupos_monitoramento"("id") ON DELETE CASCADE,
  CONSTRAINT "grupos_monitoramento_contas_conta_manychat_id_fkey"
    FOREIGN KEY ("conta_manychat_id") REFERENCES "contas_manychat"("id"),
  CONSTRAINT "grupos_monitoramento_contas_grupo_id_conta_manychat_id_key"
    UNIQUE ("grupo_id", "conta_manychat_id")
);

-- Seed: migrate existing single-conta grupos to the junction table
INSERT INTO "grupos_monitoramento_contas"
  ("id", "grupo_id", "conta_manychat_id", "tag_manychat_id", "tag_manychat_nome")
SELECT
  gen_random_uuid()::text,
  id,
  conta_manychat_id,
  tag_manychat_id,
  tag_manychat_nome
FROM "grupos_monitoramento";
