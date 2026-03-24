import { prisma } from "@/lib/db/prisma"
import { addTag } from "@/lib/manychat/tags"
import { normalizePhone, getParticipantPhone, isSystemJoinName, type ZApiWebhookPayload } from "@/lib/zapi/client"
import { tentarAutoVincularGrupo } from "@/lib/services/grupo-auto-vincular.service"
import { addWebhookJob } from "@/lib/queue/queues"

/**
 * Core logic: processes a Z-API GROUP_PARTICIPANT_ADD event.
 *
 * Steps:
 * 1. Find active GrupoMonitoramento matching chatName (case-insensitive contains)
 * 2. Normalize participant phone
 * 3. Find Contato by phone
 * 4. Find Lead by contato + campanha
 * 5. Find subscriber_id from ContatoConta
 * 6. Apply Manychat tag (best-effort)
 * 7. Upsert EntradaGrupo
 * 8. Update Lead.grupo_entrou_at
 */
export async function processarEntradaGrupo(
  instanciaId: string,
  payload: ZApiWebhookPayload
): Promise<void> {
  const { chatName = "", senderName } = payload
  const participantPhone = getParticipantPhone(payload)

  // Z-API may send the group ID in either `phone` or `chatId`
  const groupWaId = payload.phone || payload.chatId || ""

  // For GROUP_PARTICIPANT_INVITE via link, Z-API sends senderName="invite" and
  // leaves participantPhone empty, falling back to notificationParameters[0]
  // which is a WhatsApp internal ID (not a real phone). Skip these events.
  if (isSystemJoinName(senderName) && !payload.participantPhone) {
    console.warn(
      `[Entradas] GROUP_PARTICIPANT_INVITE via link sem telefone real (senderName="${senderName}") — ignorando`
    )
    return
  }

  // Use null for system-generated names (e.g. "invite") so Contato/Lead names
  // fall back to the phone number instead of storing a system string.
  const nomeSender = isSystemJoinName(senderName) ? null : (senderName ?? null)

  const telefoneNorm = normalizePhone(participantPhone)
  if (!telefoneNorm) {
    console.warn("[Entradas] participantPhone vazio — ignorando")
    return
  }

  // 1. Find all active grupos for this instância that match the group name
  const grupos = await prisma.grupoMonitoramento.findMany({
    where: {
      instancia_id: instanciaId,
      status: "ativo",
      campanha: { pausado_at: null },
    },
    include: {
      conta_manychat: { select: { id: true, api_key: true } },
    },
  })

  // 2. Match by grupo_wa_id (exact) or nome_filtro (contains)
  const matched = grupos.filter(
    (g) =>
      (groupWaId && g.grupo_wa_id === groupWaId) ||
      chatName.toLowerCase().includes(g.nome_filtro.toLowerCase())
  )

  if (matched.length === 0) {
    // Try to auto-link the group by semantic name similarity
    const auto = await tentarAutoVincularGrupo(instanciaId, groupWaId, chatName)
    if (auto.criado && auto.grupoId) {
      console.log(`[Entradas] Grupo auto-vinculado "${chatName}" (score=${auto.score.toFixed(2)}) — reprocessando entrada`)
      // Reload the newly created group and process
      const novoGrupo = await prisma.grupoMonitoramento.findUnique({
        where: { id: auto.grupoId },
        include: { conta_manychat: { select: { id: true, api_key: true } } },
      })
      if (novoGrupo) {
        await processarEntradaParaGrupo({ grupo: novoGrupo, groupWaId, groupWaName: chatName, telefoneNorm, senderName: nomeSender ?? undefined })
      }
    } else {
      console.log(`[Entradas] Nenhum grupo monitorado corresponde a "${chatName}"`)
    }
    return
  }

  console.log(`[Entradas] ${matched.length} grupo(s) correspondem a "${chatName}" para telefone ${telefoneNorm}`)

  for (const grupo of matched) {
    try {
      await processarEntradaParaGrupo({
        grupo,
        groupWaId,
        groupWaName: chatName,
        telefoneNorm,
        senderName: nomeSender ?? undefined,
      })
    } catch (err) {
      console.error(`[Entradas] Erro processando grupo ${grupo.id}:`, err)
    }
  }
}

async function processarEntradaParaGrupo({
  grupo,
  groupWaId,
  groupWaName,
  telefoneNorm,
  senderName,
}: {
  grupo: {
    id: string
    campanha_id: string
    tag_manychat_id: number
    grupo_wa_id: string | null
    conta_manychat: { id: string; api_key: string }
  }
  groupWaId: string
  groupWaName: string
  telefoneNorm: string
  senderName?: string
}): Promise<void> {
  // Save grupo_wa_id on first match (for future reference)
  if (!grupo.grupo_wa_id && groupWaId) {
    await prisma.grupoMonitoramento.update({
      where: { id: grupo.id },
      data: { grupo_wa_id: groupWaId },
    }).catch(() => {})
  }

  // 2. Find OR auto-create Contato by phone
  let contato = await prisma.contato.findFirst({
    where: {
      OR: [
        { telefone: telefoneNorm },
        { telefone: `+${telefoneNorm}` },
        ...(telefoneNorm.startsWith("55") ? [{ telefone: telefoneNorm.slice(2) }] : []),
      ],
    },
  })

  if (!contato) {
    try {
      contato = await prisma.contato.create({
        data: {
          telefone: telefoneNorm,
          nome: senderName || telefoneNorm,
        },
      })
      console.log(`[Entradas] Contato auto-criado telefone=${telefoneNorm}`)
    } catch {
      // Race condition: another concurrent job created it — retry lookup
      contato = await prisma.contato.findFirst({ where: { telefone: telefoneNorm } }) ?? null
      if (contato) console.log(`[Entradas] Contato já existia (race condition resolvida)`)
    }
  }

  // 3. Find OR auto-create Lead
  let lead: { id: string; subscriber_id: string | null } | null = null
  if (contato) {
    lead = await prisma.lead.findFirst({
      where: { contato_id: contato.id, campanha_id: grupo.campanha_id },
      select: { id: true, subscriber_id: true },
    })

    if (!lead) {
      // Look up the campaign's active webhook + pick a flow (round-robin)
      const webhook = await prisma.webhook.findFirst({
        where: { campanha_id: grupo.campanha_id, status: "ativo", deleted_at: null },
        include: {
          webhook_flows: {
            where: { status: "ativo", deleted_at: null },
            orderBy: [{ total_enviados: "asc" }, { ordem: "asc" }],
            take: 1,
          },
        },
      })

      if (webhook) {
        const flow = webhook.webhook_flows[0] ?? null
        lead = await prisma.lead.create({
          data: {
            contato_id: contato.id,
            webhook_id: webhook.id,
            campanha_id: grupo.campanha_id,
            webhook_flow_id: flow?.id ?? null,
            nome: senderName || telefoneNorm,
            telefone: telefoneNorm,
            status: flow ? "pendente" : "aguardando",
            erro_msg: "Lead não rastreado — entrada via grupo sem webhook prévio",
          },
          select: { id: true, subscriber_id: true },
        })
        console.log(`[Entradas] Lead não-rastreado criado id=${lead.id} campanha=${grupo.campanha_id}`)

        // Increment round-robin counter and enqueue for Manychat processing
        if (flow) {
          await prisma.webhookFlow.update({
            where: { id: flow.id },
            data: { total_enviados: { increment: 1 } },
          }).catch(() => {})
          await addWebhookJob({
            leadId: lead.id,
            webhookId: webhook.id,
            flowTipo: (flow.tipo as "manychat" | "webhook") ?? "manychat",
            contaId: flow.conta_id ?? undefined,
            flowNs: flow.flow_ns ?? undefined,
            webhookUrl: flow.webhook_url ?? undefined,
            nome: senderName || telefoneNorm,
            telefone: telefoneNorm,
          }).catch((err) => console.error("[Entradas] Erro ao enfileirar lead não-rastreado:", err))
        }
      } else {
        console.warn(`[Entradas] Campanha ${grupo.campanha_id} sem webhook ativo — lead não criado`)
      }
    }
  }

  // 4. Find subscriber_id — prefer lead's own, fallback to ContatoConta
  let subscriberId = lead?.subscriber_id ?? null
  if (!subscriberId && contato) {
    const cc = await prisma.contatoConta.findFirst({
      where: {
        contato_id: contato.id,
        conta_id: grupo.conta_manychat.id,
        subscriber_id: { not: null },
      },
      select: { subscriber_id: true },
    })
    subscriberId = cc?.subscriber_id ?? null
  }

  // 5. Apply Manychat tag (best-effort)
  let tagAplicada = false
  let tagErro: string | null = null

  if (subscriberId) {
    const result = await addTag(grupo.conta_manychat.api_key, subscriberId, grupo.tag_manychat_id)
    tagAplicada = result.ok
    tagErro = result.error ?? null
    console.log(`[Entradas] addTag subscriber=${subscriberId} tag=${grupo.tag_manychat_id} → ${result.ok ? "ok" : result.error}`)
  } else {
    tagErro = "subscriber_id não encontrado — tag não aplicada"
    console.warn(`[Entradas] Sem subscriber_id para telefone ${telefoneNorm}`)
  }

  // 6. Upsert EntradaGrupo (re-entry updates timestamp + tag status)
  await prisma.entradaGrupo.upsert({
    where: { grupo_id_telefone: { grupo_id: grupo.id, telefone: telefoneNorm } },
    create: {
      grupo_id: grupo.id,
      lead_id: lead?.id ?? null,
      contato_id: contato?.id ?? null,
      telefone: telefoneNorm,
      nome_whatsapp: senderName ?? null,
      grupo_wa_id: groupWaId,
      grupo_wa_nome: groupWaName,
      subscriber_id: subscriberId,
      tag_aplicada: tagAplicada,
      tag_erro: tagErro,
    },
    update: {
      lead_id: lead?.id ?? null,
      contato_id: contato?.id ?? null,
      nome_whatsapp: senderName ?? null,
      grupo_wa_id: groupWaId,
      grupo_wa_nome: groupWaName,
      subscriber_id: subscriberId,
      tag_aplicada: tagAplicada,
      tag_erro: tagErro,
      entrou_at: new Date(),
    },
  })

  // 7. Update Lead.grupo_entrou_at
  if (lead?.id) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { grupo_entrou_at: new Date() },
    })
    console.log(`[Entradas] Lead ${lead.id} marcado como entrou_grupo`)
  }

  // 8. Notify external webhook flow (best-effort)
  //    For leads whose flow is tipo="webhook", POST the group entry event to the webhook URL.
  //    This is the counterpart of applying a Manychat tag for Manychat flows.
  if (lead?.id) {
    const leadWithFlow = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: {
        email: true,
        nome: true,
        webhook_flow: { select: { tipo: true, webhook_url: true } },
      },
    }).catch(() => null)

    const extUrl = leadWithFlow?.webhook_flow?.tipo === "webhook"
      ? leadWithFlow.webhook_flow.webhook_url
      : null

    if (extUrl) {
      fetch(extUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "entrou_grupo",
          lead_id: lead.id,
          nome: leadWithFlow?.nome ?? senderName ?? telefoneNorm,
          telefone: telefoneNorm,
          email: leadWithFlow?.email ?? null,
          grupo_nome: groupWaName,
          grupo_wa_id: groupWaId,
          entrou_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10_000),
      })
        .then((r) => console.log(`[Entradas] Webhook externo entrou_grupo → ${extUrl} (${r.status})`))
        .catch((err) => console.error(`[Entradas] Webhook externo entrou_grupo falhou → ${extUrl}:`, err))
    }
  }
}
