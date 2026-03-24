-- Fix column type mismatch: drop uuid column if exists, recreate as text
ALTER TABLE "campanhas" DROP COLUMN IF EXISTS "instancia_zapi_id";
ALTER TABLE "campanhas" ADD COLUMN "instancia_zapi_id" TEXT;

ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_instancia_zapi_id_fkey"
  FOREIGN KEY ("instancia_zapi_id") REFERENCES "instancias_zapi"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
