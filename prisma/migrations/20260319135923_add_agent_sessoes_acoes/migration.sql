-- CreateEnum
CREATE TYPE "AgentSessaoStatus" AS ENUM ('executando', 'concluido', 'erro');

-- CreateTable
CREATE TABLE "agent_sessoes" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "resposta" TEXT,
    "status" "AgentSessaoStatus" NOT NULL DEFAULT 'executando',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_acoes" (
    "id" TEXT NOT NULL,
    "sessao_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "resultado" JSONB,
    "erro" TEXT,
    "ordem" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_acoes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "agent_sessoes" ADD CONSTRAINT "agent_sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_acoes" ADD CONSTRAINT "agent_acoes_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "agent_sessoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
