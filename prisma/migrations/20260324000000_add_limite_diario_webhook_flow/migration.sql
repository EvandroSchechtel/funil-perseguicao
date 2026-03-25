-- Add limite_diario to webhook_flows for per-flow daily send limits
ALTER TABLE "webhook_flows" ADD COLUMN "limite_diario" INTEGER;
