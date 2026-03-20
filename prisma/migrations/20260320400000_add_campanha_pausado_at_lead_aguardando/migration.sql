-- AlterEnum: add aguardando to LeadStatus
ALTER TYPE "LeadStatus" ADD VALUE 'aguardando';

-- AlterTable: add pausado_at to campanhas
ALTER TABLE "campanhas" ADD COLUMN "pausado_at" TIMESTAMP(3);
