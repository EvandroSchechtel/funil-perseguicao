-- Migration: Portal do Cliente + Sistema de Demandas + Notificações WA

-- 1. Adicionar role cliente ao enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'cliente';

-- 2. Adicionar enums de demanda
DO $$ BEGIN
  CREATE TYPE "TipoDemanda" AS ENUM ('nova_campanha', 'ajuste_funil', 'relatorio_customizado', 'suporte_tecnico', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatusDemanda" AS ENUM ('aberta', 'em_analise', 'em_execucao', 'aguardando_cliente', 'concluida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PrioridadeDemanda" AS ENUM ('baixa', 'normal', 'alta', 'urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Adicionar campos WA + instância de notificação ao Cliente
ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "grupo_wa_id"             TEXT,
  ADD COLUMN IF NOT EXISTS "grupo_wa_nome"            TEXT,
  ADD COLUMN IF NOT EXISTS "instancia_zapi_notif_id"  TEXT;

ALTER TABLE "clientes"
  DROP CONSTRAINT IF EXISTS "clientes_instancia_zapi_notif_id_fkey";

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_instancia_zapi_notif_id_fkey"
    FOREIGN KEY ("instancia_zapi_notif_id") REFERENCES "instancias_zapi"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Adicionar cliente_id ao Usuario (para role=cliente)
ALTER TABLE "usuarios"
  ADD COLUMN IF NOT EXISTS "cliente_id" UUID;

ALTER TABLE "usuarios"
  DROP CONSTRAINT IF EXISTS "usuarios_cliente_id_fkey";

ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Criar tabela demandas
CREATE TABLE IF NOT EXISTS "demandas" (
  "id"               TEXT NOT NULL,
  "titulo"           TEXT NOT NULL,
  "descricao"        TEXT NOT NULL,
  "tipo"             "TipoDemanda" NOT NULL,
  "status"           "StatusDemanda" NOT NULL DEFAULT 'aberta',
  "prioridade"       "PrioridadeDemanda" NOT NULL DEFAULT 'normal',
  "cliente_id"       UUID NOT NULL,
  "criado_por"       TEXT NOT NULL,
  "atribuido_a"      TEXT,
  "grupo_wa_id"      TEXT,
  "wa_msg_id_inicio" TEXT,
  "agente_ativo"     BOOLEAN NOT NULL DEFAULT false,
  "agente_sessao_id" TEXT,
  "resolvido_at"     TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "demandas_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "demandas"
  DROP CONSTRAINT IF EXISTS "demandas_cliente_id_fkey",
  DROP CONSTRAINT IF EXISTS "demandas_criado_por_fkey",
  DROP CONSTRAINT IF EXISTS "demandas_atribuido_a_fkey",
  DROP CONSTRAINT IF EXISTS "demandas_agente_sessao_id_fkey";

ALTER TABLE "demandas"
  ADD CONSTRAINT "demandas_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "demandas_criado_por_fkey"
    FOREIGN KEY ("criado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "demandas_atribuido_a_fkey"
    FOREIGN KEY ("atribuido_a") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "demandas_agente_sessao_id_fkey"
    FOREIGN KEY ("agente_sessao_id") REFERENCES "agent_sessoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "demandas_cliente_id_idx" ON "demandas"("cliente_id");
CREATE INDEX IF NOT EXISTS "demandas_status_idx" ON "demandas"("status");

-- 6. Criar tabela comentarios_demanda
CREATE TABLE IF NOT EXISTS "comentarios_demanda" (
  "id"         TEXT NOT NULL,
  "demanda_id" TEXT NOT NULL,
  "autor_id"   TEXT NOT NULL,
  "texto"      TEXT NOT NULL,
  "interno"    BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comentarios_demanda_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "comentarios_demanda"
  DROP CONSTRAINT IF EXISTS "comentarios_demanda_demanda_id_fkey";

ALTER TABLE "comentarios_demanda"
  ADD CONSTRAINT "comentarios_demanda_demanda_id_fkey"
    FOREIGN KEY ("demanda_id") REFERENCES "demandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "comentarios_demanda_demanda_id_idx" ON "comentarios_demanda"("demanda_id");

-- 7. Criar tabela mensagens_wa_demanda
CREATE TABLE IF NOT EXISTS "mensagens_wa_demanda" (
  "id"                     TEXT NOT NULL,
  "demanda_id"             TEXT NOT NULL,
  "direcao"                TEXT NOT NULL,
  "texto"                  TEXT NOT NULL,
  "autor_nome"             TEXT,
  "autor_wa_id"            TEXT,
  "wa_msg_id"              TEXT,
  "processado_por_agente"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mensagens_wa_demanda_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mensagens_wa_demanda"
  DROP CONSTRAINT IF EXISTS "mensagens_wa_demanda_demanda_id_fkey";

ALTER TABLE "mensagens_wa_demanda"
  ADD CONSTRAINT "mensagens_wa_demanda_demanda_id_fkey"
    FOREIGN KEY ("demanda_id") REFERENCES "demandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "mensagens_wa_demanda_demanda_id_idx" ON "mensagens_wa_demanda"("demanda_id");

-- 8. Criar tabela gatilhos_agente
CREATE TABLE IF NOT EXISTS "gatilhos_agente" (
  "id"          TEXT NOT NULL,
  "demanda_id"  TEXT,
  "grupo_wa_id" TEXT NOT NULL,
  "mensagem"    TEXT NOT NULL,
  "autor_wa_id" TEXT NOT NULL,
  "wa_msg_id"   TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'pendente',
  "erro"        TEXT,
  "sessao_id"   TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gatilhos_agente_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "gatilhos_agente"
  DROP CONSTRAINT IF EXISTS "gatilhos_agente_demanda_id_fkey",
  DROP CONSTRAINT IF EXISTS "gatilhos_agente_sessao_id_fkey";

ALTER TABLE "gatilhos_agente"
  ADD CONSTRAINT "gatilhos_agente_demanda_id_fkey"
    FOREIGN KEY ("demanda_id") REFERENCES "demandas"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "gatilhos_agente_sessao_id_fkey"
    FOREIGN KEY ("sessao_id") REFERENCES "agent_sessoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "gatilhos_agente_status_idx" ON "gatilhos_agente"("status");
