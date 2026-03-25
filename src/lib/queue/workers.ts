import { Worker, Job } from "bullmq"
import { getRedisConfig } from "./redis"
import { prisma } from "@/lib/db/prisma"
import { processLeadInManychat, setWhatsappIdField } from "@/lib/manychat/client"
import { isLimitReached, incrementUsage, msUntilMidnightBRT, isFlowLimitReached } from "@/lib/services/uso-diario.service"
import { processarEntradaGrupo } from "@/lib/services/entradas.service"
import { processarSaidaGrupo } from "@/lib/services/saidas.service"
import { executarMonitoramento } from "@/lib/services/monitor.service"
import type { WebhookJobData, GrupoEventoJobData } from "./queues"

async function sendWebhookOutput(
  url: string,
  data: { lead_id: string; nome: string; telefone: string; email?: string; campanha_id?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export function startWebhookWorker(): Worker {
  const worker = new Worker(
    "webhooks",
    async (job: Job<WebhookJobData>) => {
      const { leadId, flowTipo, contaId, flowNs, webhookUrl, nome, telefone, email } = job.data
      const isWebhookFlow = flowTipo === "webhook"

      console.log(`[Worker] Processing lead ${leadId} (job ${job.id}, tipo=${flowTipo ?? "manychat"})`)

      // 1. Mark lead as processando, increment tentativas
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: { status: "processando", tentativas: { increment: 1 } },
        select: { tentativas: true, contato_id: true, campanha_id: true, subscriber_id: true, webhook_flow_id: true },
      })
      const numeroTentativa = updated.tentativas

      // ── Webhook externo ──────────────────────────────────────────────────────
      if (isWebhookFlow) {
        if (!webhookUrl) {
          const errMsg = "Flow do tipo webhook sem URL configurada."
          console.error(`[Worker] ${errMsg} lead=${leadId}`)
          await prisma.lead.update({ where: { id: leadId }, data: { status: "falha", erro_msg: errMsg } })
          await prisma.leadTentativa.create({
            data: { lead_id: leadId, numero: numeroTentativa, status: "falha", erro_msg: errMsg, flow_ns: webhookUrl ?? null },
          })
          // Don't throw — misconfigured URL won't be fixed by retrying
          return { leadId, ok: false, error: errMsg }
        }

        // Check per-flow daily limit (if configured)
        if (updated.webhook_flow_id) {
          const flow = await prisma.webhookFlow.findUnique({
            where: { id: updated.webhook_flow_id },
            select: { limite_diario: true },
          })
          if (flow?.limite_diario) {
            const limitReached = await isFlowLimitReached(updated.webhook_flow_id, flow.limite_diario)
            if (limitReached) {
              const delay = msUntilMidnightBRT()
              await job.moveToDelayed(Date.now() + delay)
              await prisma.lead.update({ where: { id: leadId }, data: { status: "pendente", tentativas: { decrement: 1 } } })
              console.log(`[Worker] Lead ${leadId} — flow ${updated.webhook_flow_id} at daily limit, delayed ${Math.round(delay / 60000)}min`)
              return { leadId, delayed: true }
            }
          }
        }

        const result = await sendWebhookOutput(webhookUrl, {
          lead_id: leadId,
          nome,
          telefone,
          email,
          campanha_id: updated.campanha_id,
        })

        if (result.ok) {
          await prisma.lead.update({
            where: { id: leadId },
            data: { status: "sucesso", processado_at: new Date(), erro_msg: null },
          })
          await prisma.leadTentativa.create({
            data: { lead_id: leadId, numero: numeroTentativa, status: "sucesso", flow_ns: webhookUrl },
          }).catch((e) => console.warn("[Worker] leadTentativa.create failed:", e))
          console.log(`[Worker] Lead ${leadId} sent to external webhook ${webhookUrl}`)
        } else {
          await prisma.lead.update({
            where: { id: leadId },
            data: { status: "falha", erro_msg: result.error },
          })
          await prisma.leadTentativa.create({
            data: { lead_id: leadId, numero: numeroTentativa, status: "falha", erro_msg: result.error ?? null, flow_ns: webhookUrl },
          }).catch((e) => console.warn("[Worker] leadTentativa.create failed:", e))
          throw new Error(result.error) // triggers BullMQ retry
        }

        return { leadId, ok: result.ok }
      }

      // ── Manychat ─────────────────────────────────────────────────────────────

      // Guard: contaId and flowNs must be present for Manychat flows
      if (!contaId || !flowNs) {
        const errMsg = "contaId/flowNs ausente para flow Manychat (job mal configurado)."
        console.error(`[Worker] ${errMsg} lead=${leadId}`)
        await prisma.lead.update({ where: { id: leadId }, data: { status: "falha", erro_msg: errMsg } })
        return { leadId, ok: false, error: errMsg }
      }

      // 2. Get API key from conta
      const conta = await prisma.contaManychat.findFirst({
        where: { id: contaId, deleted_at: null },
        select: { api_key: true, whatsapp_field_id: true, nome: true, limite_diario: true },
      })

      if (!conta) {
        const errMsg = `Conta Manychat não encontrada ou inativa (id=${contaId}).`
        console.error(`[Worker] ${errMsg} lead=${leadId}`)
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "falha", erro_msg: errMsg },
        })
        await prisma.leadTentativa.create({
          data: { lead_id: leadId, numero: numeroTentativa, status: "falha", erro_msg: errMsg, flow_ns: flowNs },
        })
        // Don't throw — retrying won't fix a missing conta; just discard the job
        return { leadId, ok: false, error: errMsg }
      }

      // 2b. Safety check — if daily limit was reached between enqueue and now, delay until 8am BRT
      const limitReached = await isLimitReached(contaId!, conta.limite_diario)
      if (limitReached) {
        const delay = msUntilMidnightBRT()
        await job.moveToDelayed(Date.now() + delay)
        console.log(`[Worker] Lead ${leadId} — conta ${contaId} at daily limit, delayed ${Math.round(delay / 60000)}min`)
        // Revert status back to pendente
        await prisma.lead.update({ where: { id: leadId }, data: { status: "pendente", tentativas: { decrement: 1 } } })
        return { leadId, delayed: true }
      }

      // 3. Process in Manychat — look up account-specific subscriber_id from ContatoConta.
      // NEVER use Lead.subscriber_id directly: it may be from a different Manychat account.
      // ContatoConta is keyed by (contato_id, conta_id) — always account-specific.
      // Wrapped in try/catch: if lookup fails, fall back to undefined (full lookup path).
      let knownSubscriberId: string | undefined
      if (updated.contato_id) {
        try {
          const contatoConta = await prisma.contatoConta.findUnique({
            where: { contato_id_conta_id: { contato_id: updated.contato_id, conta_id: contaId } },
          })
          knownSubscriberId = contatoConta?.subscriber_id ?? undefined
        } catch (e) {
          console.warn("[Worker] contatoConta.findUnique failed — proceeding without knownSubscriberId:", e)
        }
      }
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
          data: { status: "sem_optin", erro_msg: result.error, subscriber_id: result.subscriber_id ?? null },
        })
        try {
          await prisma.leadTentativa.create({
            data: {
              lead_id: leadId,
              numero: numeroTentativa,
              status: "sem_optin",
              erro_msg: result.error ?? null,
              subscriber_id: result.subscriber_id ?? null,
              flow_ns: flowNs,
              conta_nome: conta.nome,
            },
          })
        } catch (e) { console.warn("[Worker] leadTentativa.create failed:", e) }
        console.warn(`[Worker] Lead ${leadId} sem_optin — skipping retries`)

      } else {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "falha", erro_msg: result.error, subscriber_id: result.subscriber_id ?? null },
        })
        try {
          await prisma.leadTentativa.create({
            data: {
              lead_id: leadId,
              numero: numeroTentativa,
              status: "falha",
              erro_msg: result.error ?? null,
              subscriber_id: result.subscriber_id ?? null,
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
