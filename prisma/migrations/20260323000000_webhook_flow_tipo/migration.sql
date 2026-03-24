-- Add tipo and webhook_url fields to webhook_flows
-- Make conta_id and flow_ns nullable to support external webhook flows

ALTER TABLE "webhook_flows" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'manychat';
ALTER TABLE "webhook_flows" ADD COLUMN "webhook_url" TEXT;
ALTER TABLE "webhook_flows" ALTER COLUMN "conta_id" DROP NOT NULL;
ALTER TABLE "webhook_flows" ALTER COLUMN "flow_ns" DROP NOT NULL;
