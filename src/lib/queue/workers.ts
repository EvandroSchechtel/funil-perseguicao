import { Worker, Job } from "bullmq"
import { getRedisConfig } from "./redis"
import { prisma } from "@/lib/db/prisma"
import { processLeadInManychat, setWhatsappIdField } from "@/lib/manychat/client"
import { isLimitReached, incrementUsage, msUntilMidnightBRT } from "@/lib/services/uso-diario.service"
import { processarEntradaGrupo } from "@/lib/services/entradas.service"
import { processarSaidaGrupo } from "@/lib/services/saidas.service"
import { executarMonitoramento } from "@/lib/services/monitor.service"
import type { WebhookJobData, GrupoEventoJobData } from "./queues"

export function startWebhookWorker(): Worker {
  const worker = new Worker(
    "webhooks",
    async (job: Job<WebhookJobData>) => {
      const { leadId, contaId, flowNs, nome, telefone, email } = job.data

      console.log(`[Worker] Processing lead ${leadId} (job ${job.id})`)

      // 1. Mark lead as processando, increment tentativas
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: { status: "processando", tentativas: { increment: 1 } },
        select: { tentativas: true, contato_id: true, campanha_id: true, subscriber_id: true },
      })
      const numeroTentativa = updated.tentativas

      // 2. Get API key from conta
      const conta = await prisma.contaManychat.findFirst({
        where: { id: contaId, deleted_at: null },
        select: { api_key: true, whatsapp_field_id: true, nome: true, limite_diario: true },
      })

      if (!conta) {
        const errMsg = "Conta Manychat não encontrada ou inativa."
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "falha", erro_msg: errMsg },
        })
        await prisma.leadTentativa.create({
          data: { lead_id: leadId, numero: numeroTentativa, status: "falha", erro_msg: errMsg, flow_ns: flowNs },
        })
        throw new Error(errMsg)
      }

      // 2b. Safety check — if daily limit was reached between enqueue and now, delay until midnight
      const limitReached = await isLimitReached(contaId, conta.limite_diario)
      if (limitReached) {
        const delay = msUntilMidnightBRT()
        await job.moveToDelayed(Date.now() + delay)
        console.log(`[Worker] Lead ${leadId} — conta ${contaId} at daily limit, delayed ${Math.round(delay / 60000)}min`)
        // Revert status back to pendente
        await prisma.lead.update({ where: { id: leadId }, data: { status: "pendente", tentativas: { decrement: 1 } } })
        return { leadId, delayed: true }
      }

      // 3. Process in Manychat — if subscriber_id already known, skip lookup
      const knownSubscriberId = updated.subscriber_id ?? undefined
      const result = await processLeadInManychat(
        conta.api_key,
        { nome, telefone, email },
        flowNs,
        conta.whatsapp_field_id,
        knownSubscriberId,
      )

      if (result.ok) {
        // 4a. Success — update lead + record tentativa + upsert ContatoConta
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            status: "sucesso",
            processado_at: new Date(),
            subscriber_id: result.subscriber_id ?? null,
            erro_msg: null,
          },
        })

        try {
          await prisma.leadTentativa.create({
            data: {
              lead_id: leadId,
              numero: numeroTentativa,
              status: "sucesso",
              subscriber_id: result.subscriber_id ?? null,
              flow_ns: flowNs,
              conta_nome: conta.nome,
            },
          })
        } catch (e) { console.warn("[Worker] leadTentativa.create failed (table may not exist yet):", e) }

        // Upsert ContatoConta — vincula o subscriber_id desta conta a este contato
        if (updated.contato_id && result.subscriber_id) {
          try {
            await prisma.contatoConta.upsert({
              where: { contato_id_conta_id: { contato_id: updated.contato_id, conta_id: contaId } },
              update: { subscriber_id: result.subscriber_id, campanha_id: updated.campanha_id },
              create: {
                contato_id: updated.contato_id,
                conta_id: contaId,
                subscriber_id: result.subscriber_id,
                campanha_id: updated.campanha_id,
              },
            })
          } catch (e) { console.warn("[Worker] contatoConta.upsert failed (table may not exist yet):", e) }
        }

        // Increment daily usage counter
        incrementUsage(contaId).catch((e) => console.warn("[Worker] incrementUsage failed:", e))

        // Best-effort: write phone to [esc]whatsapp-id custom field in Manychat
        if (result.subscriber_id) {
          setWhatsappIdField(conta.api_key, result.subscriber_id, telefone, conta.whatsapp_field_id).catch(() => {})
        }

        console.log(`[Worker] Lead ${leadId} processed successfully (subscriber: ${result.subscriber_id})`)

      } else if (result.sem_optin) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "sem_optin", erro_msg: result.error },
        })
        try {
          await prisma.leadTentativa.create({
            data: {
              lead_id: leadId,
              numero: numeroTentativa,
              status: "sem_optin",
              erro_msg: result.error ?? null,
              flow_ns: flowNs,
              conta_nome: conta.nome,
            },
          })
        } catch (e) { console.warn("[Worker] leadTentativa.create failed:", e) }
        console.warn(`[Worker] Lead ${leadId} sem_optin — skipping retries`)

      } else {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "falha", erro_msg: result.error },
        })
        try {
          await prisma.leadTentativa.create({
            data: {
              lead_id: leadId,
              numero: numeroTentativa,
              status: "falha",
              erro_msg: result.error ?? null,
              flow_ns: flowNs,
              conta_nome: conta.nome,
            },
          })
        } catch (e) { console.warn("[Worker] leadTentativa.create failed:", e) }
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

// ── Grupo Eventos Worker ───────────────────────────────────────────────────────

export function startGrupoEventosWorker(): Worker {
  const worker = new Worker(
    "grupo-eventos",
    async (job: Job<GrupoEventoJobData>) => {
      const { tipo, instanciaId, payload } = job.data
      if (tipo === "entrada") {
        await processarEntradaGrupo(instanciaId, payload)
      } else {
        await processarSaidaGrupo(instanciaId, payload)
      }
    },
    {
      connection: getRedisConfig(),
      concurrency: 3,
    }
  )

  worker.on("completed", (job) => {
    console.log(`[GrupoWorker] Job ${job.id} concluído`)
  })

  worker.on("failed", (job, err) => {
    console.error(`[GrupoWorker] Job ${job?.id} falhou (tentativa ${job?.attemptsMade}): ${err.message}`)
  })

  return worker
}

// ── Monitor Worker ─────────────────────────────────────────────────────────────

export function startMonitorWorker(): Worker {
  const worker = new Worker(
    "monitor",
    async () => { await executarMonitoramento() },
    { connection: getRedisConfig(), concurrency: 1 }
  )
  worker.on("completed", () => console.log("[MonitorWorker] Health check concluído"))
  worker.on("failed", (job, err) =>
    console.error(`[MonitorWorker] Erro no health check: ${err.message}`)
  )
  return worker
}
