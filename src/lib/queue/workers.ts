import { Worker, Job } from "bullmq"
import { getRedisConfig } from "./redis"
import { prisma } from "@/lib/db/prisma"
import { processLeadInManychat } from "@/lib/manychat/client"
import type { WebhookJobData } from "./queues"

export function startWebhookWorker(): Worker {
  const worker = new Worker(
    "webhooks",
    async (job: Job<WebhookJobData>) => {
      const { leadId, contaId, flowNs, nome, telefone, email } = job.data

      console.log(`[Worker] Processing lead ${leadId} (job ${job.id})`)

      // 1. Mark lead as processando
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "processando", tentativas: { increment: 1 } },
      })

      // 2. Get API key from conta
      const conta = await prisma.contaManychat.findFirst({
        where: { id: contaId, deleted_at: null },
        select: { api_key: true },
      })

      if (!conta) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "falha", erro_msg: "Conta Manychat não encontrada ou inativa." },
        })
        throw new Error("Conta Manychat não encontrada")
      }

      // 3. Process in Manychat (find/create subscriber → send flow)
      const result = await processLeadInManychat(conta.api_key, { nome, telefone, email }, flowNs)

      // 4. Update lead status based on result
      if (result.ok) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "sucesso", processado_at: new Date(), erro_msg: null },
        })
        console.log(`[Worker] Lead ${leadId} processed successfully (subscriber: ${result.subscriber_id})`)
      } else {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "falha", erro_msg: result.error },
        })
        throw new Error(result.error) // triggers BullMQ retry
      }

      return { leadId, ok: true }
    },
    {
      connection: getRedisConfig(),
      concurrency: 5,
    }
  )

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`)
  })

  return worker
}
