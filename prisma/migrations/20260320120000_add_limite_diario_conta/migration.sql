-- AddColumn limite_diario to contas_manychat
ALTER TABLE "contas_manychat" ADD COLUMN IF NOT EXISTS "limite_diario" INTEGER;

-- CreateTable conta_uso_diario
CREATE TABLE IF NOT EXISTS "conta_uso_diario" (
    "id"         TEXT NOT NULL,
    "conta_id"   TEXT NOT NULL,
    "data"       DATE NOT NULL,
    "total"      INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conta_uso_diario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex unique (conta_id, data)
CREATE UNIQUE INDEX IF NOT EXISTS "conta_uso_diario_conta_id_data_key"
    ON "conta_uso_diario"("conta_id", "data");

-- AddForeignKey
ALTER TABLE "conta_uso_diario" DROP CONSTRAINT IF EXISTS "conta_uso_diario_conta_id_fkey";
ALTER TABLE "conta_uso_diario" ADD CONSTRAINT "conta_uso_diario_conta_id_fkey"
    FOREIGN KEY ("conta_id") REFERENCES "contas_manychat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
