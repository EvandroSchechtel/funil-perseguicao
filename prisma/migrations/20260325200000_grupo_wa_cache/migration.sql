-- Cache de grupos WhatsApp por instância Z-API
-- Evita chamar Z-API API a cada abertura do formulário de novo grupo

CREATE TABLE "grupos_wa_cache" (
    "id" TEXT NOT NULL,
    "instancia_id" TEXT NOT NULL,
    "grupo_wa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "grupos_wa_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grupos_wa_cache_instancia_id_grupo_wa_id_key"
    ON "grupos_wa_cache"("instancia_id", "grupo_wa_id");

ALTER TABLE "grupos_wa_cache"
    ADD CONSTRAINT "grupos_wa_cache_instancia_id_fkey"
    FOREIGN KEY ("instancia_id") REFERENCES "instancias_zapi"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
