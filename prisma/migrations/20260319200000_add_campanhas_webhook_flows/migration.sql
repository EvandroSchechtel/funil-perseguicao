-- CreateTable: campanhas
CREATE TABLE "campanhas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ativo',
    "data_inicio" TIMESTAMP(3),
    "data_fim" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable: webhook_flows
CREATE TABLE "webhook_flows" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "conta_id" TEXT NOT NULL,
    "flow_ns" TEXT NOT NULL,
    "flow_nome" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "total_enviados" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "webhook_flows_pkey" PRIMARY KEY ("id")
);

-- AlterTable: webhooks — drop old columns, add campanha_id
ALTER TABLE "webhooks" DROP CONSTRAINT IF EXISTS "webhooks_conta_id_fkey";
ALTER TABLE "webhooks" ADD COLUMN "campanha_id" TEXT;
ALTER TABLE "webhooks" DROP COLUMN IF EXISTS "conta_id";
ALTER TABLE "webhooks" DROP COLUMN IF EXISTS "flow_ns";
ALTER TABLE "webhooks" DROP COLUMN IF EXISTS "flow_nome";

-- AlterTable: leads — add tracking columns
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "campanha_id" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "webhook_flow_id" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "subscriber_id" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "flow_executado" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "conta_nome" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "manychat_log" JSONB;

-- AddForeignKey: campanhas
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: webhook_flows
ALTER TABLE "webhook_flows" ADD CONSTRAINT "webhook_flows_webhook_id_fkey"
    FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "webhook_flows" ADD CONSTRAINT "webhook_flows_conta_id_fkey"
    FOREIGN KEY ("conta_id") REFERENCES "contas_manychat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: webhooks → campanhas
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_campanha_id_fkey"
    FOREIGN KEY ("campanha_id") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: leads → campanhas
ALTER TABLE "leads" ADD CONSTRAINT "leads_campanha_id_fkey"
    FOREIGN KEY ("campanha_id") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: leads → webhook_flows
ALTER TABLE "leads" ADD CONSTRAINT "leads_webhook_flow_id_fkey"
    FOREIGN KEY ("webhook_flow_id") REFERENCES "webhook_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
