-- Allow multiple GrupoMonitoramento per (campanha_id, instancia_id)
-- Previously had @@unique([campanha_id, instancia_id]) which blocked auto-linking new groups.
-- Replace with a partial unique on (instancia_id, grupo_wa_id) when grupo_wa_id is known.

ALTER TABLE "grupos_monitoramento" DROP CONSTRAINT IF EXISTS "grupos_monitoramento_campanha_id_instancia_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "grupos_monitoramento_instancia_id_grupo_wa_id_key"
  ON "grupos_monitoramento" ("instancia_id", "grupo_wa_id")
  WHERE "grupo_wa_id" IS NOT NULL;
