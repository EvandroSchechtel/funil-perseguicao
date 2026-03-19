-- CreateTable
CREATE TABLE "contas_manychat" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "page_id" TEXT,
    "page_name" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ativo',
    "ultimo_sync" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contas_manychat_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contas_manychat" ADD CONSTRAINT "contas_manychat_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
