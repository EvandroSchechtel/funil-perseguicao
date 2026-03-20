-- AddColumn grupo_entrou_at to leads
ALTER TABLE "leads" ADD COLUMN "grupo_entrou_at" TIMESTAMP(3);

-- CreateTable instancias_zapi
CREATE TABLE "instancias_zapi" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "client_token" TEXT NOT NULL,
    "webhook_token" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ativo',
    "cliente_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "instancias_zapi_pkey" PRIMARY KEY ("id")
);

-- CreateTable grupos_monitoramento
CREATE TABLE "grupos_monitoramento" (
    "id" TEXT NOT NULL,
    "instancia_id" TEXT NOT NULL,
    "campanha_id" TEXT NOT NULL,
    "conta_manychat_id" TEXT NOT NULL,
    "nome_filtro" TEXT NOT NULL,
    "grupo_wa_id" TEXT,
    "tag_manychat_id" INTEGER NOT NULL,
    "tag_manychat_nome" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_monitoramento_pkey" PRIMARY KEY ("id")
);

-- CreateTable entradas_grupo
CREATE TABLE "entradas_grupo" (
    "id" TEXT NOT NULL,
    "grupo_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "contato_id" TEXT,
    "telefone" TEXT NOT NULL,
    "nome_whatsapp" TEXT,
    "grupo_wa_id" TEXT NOT NULL,
    "grupo_wa_nome" TEXT NOT NULL,
    "subscriber_id" TEXT,
    "tag_aplicada" BOOLEAN NOT NULL DEFAULT false,
    "tag_erro" TEXT,
    "entrou_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entradas_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instancias_zapi_webhook_token_key" ON "instancias_zapi"("webhook_token");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_monitoramento_campanha_id_instancia_id_key" ON "grupos_monitoramento"("campanha_id", "instancia_id");

-- CreateIndex
CREATE UNIQUE INDEX "entradas_grupo_grupo_id_telefone_key" ON "entradas_grupo"("grupo_id", "telefone");

-- AddForeignKey instancias_zapi → clientes
ALTER TABLE "instancias_zapi" ADD CONSTRAINT "instancias_zapi_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey instancias_zapi → usuarios
ALTER TABLE "instancias_zapi" ADD CONSTRAINT "instancias_zapi_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey grupos_monitoramento → instancias_zapi
ALTER TABLE "grupos_monitoramento" ADD CONSTRAINT "grupos_monitoramento_instancia_id_fkey"
    FOREIGN KEY ("instancia_id") REFERENCES "instancias_zapi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey grupos_monitoramento → campanhas
ALTER TABLE "grupos_monitoramento" ADD CONSTRAINT "grupos_monitoramento_campanha_id_fkey"
    FOREIGN KEY ("campanha_id") REFERENCES "campanhas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey grupos_monitoramento → contas_manychat
ALTER TABLE "grupos_monitoramento" ADD CONSTRAINT "grupos_monitoramento_conta_manychat_id_fkey"
    FOREIGN KEY ("conta_manychat_id") REFERENCES "contas_manychat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey entradas_grupo → grupos_monitoramento
ALTER TABLE "entradas_grupo" ADD CONSTRAINT "entradas_grupo_grupo_id_fkey"
    FOREIGN KEY ("grupo_id") REFERENCES "grupos_monitoramento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey entradas_grupo → leads
ALTER TABLE "entradas_grupo" ADD CONSTRAINT "entradas_grupo_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
