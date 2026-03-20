import { prisma } from "@/lib/db/prisma"
import { sendTextMessage } from "@/lib/zapi/client"
import type { TipoDemanda, StatusDemanda, PrioridadeDemanda } from "@/generated/prisma/client"

// ── Label maps ────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<TipoDemanda, string> = {
  nova_campanha:        "Nova Campanha",
  ajuste_funil:         "Ajuste de Funil",
  relatorio_customizado: "Relatório Customizado",
  suporte_tecnico:      "Suporte Técnico",
  outro:                "Outro",
}

const STATUS_LABELS: Record<StatusDemanda, string> = {
  aberta:             "Aberta",
  em_analise:         "Em Análise",
  em_execucao:        "Em Execução",
  aguardando_cliente: "Aguardando Cliente",
  concluida:          "Concluída",
  cancelada:          "Cancelada",
}

const PRIORIDADE_LABELS: Record<PrioridadeDemanda, string> = {
  baixa:   "Baixa",
  normal:  "Normal",
  alta:    "Alta",
  urgente: "Urgente",
}

// ── Core sender ───────────────────────────────────────────────────────────────

/**
 * Sends a WA message to the client's group and logs it in MensagemWaDemanda.
 * All errors are caught and logged — never thrown.
 */
export async function notificarDemandaWa(params: {
  demandaId: string
  clienteId: string
  mensagem: string
  replyToMsgId?: string
}): Promise<{ enviado: boolean; waMsgId?: string }> {
  const { demandaId, clienteId, mensagem, replyToMsgId } = params

  try {
    // 1. Fetch cliente with instância de notificação
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: {
        grupo_wa_id:          true,
        instancia_zapi_notif: {
          select: {
            instance_id:  true,
            token:        true,
            client_token: true,
          },
        },
      },
    })

    if (!cliente?.grupo_wa_id) {
      console.warn(`[NotifWA] demanda=${demandaId} cliente=${clienteId} — sem grupo_wa_id configurado`)
      return { enviado: false }
    }

    if (!cliente.instancia_zapi_notif) {
      console.warn(`[NotifWA] demanda=${demandaId} cliente=${clienteId} — sem instância Z-API de notificação`)
      return { enviado: false }
    }

    const { instance_id, token, client_token } = cliente.instancia_zapi_notif

    // 2. Send via Z-API
    const zapiResult = await sendTextMessage(
      instance_id,
      token,
      client_token,
      cliente.grupo_wa_id,
      mensagem,
      replyToMsgId,
    )

    const waMsgId: string | undefined =
      (zapiResult?.zaapId as string | undefined) ??
      (zapiResult?.messageId as string | undefined) ??
      (zapiResult?.id as string | undefined)

    // 3. Log in mensagens_wa_demanda
    await prisma.mensagemWaDemanda.create({
      data: {
        demanda_id: demandaId,
        direcao:    "saida",
        texto:      mensagem,
        wa_msg_id:  waMsgId ?? null,
      },
    })

    // 4. If first message and no wa_msg_id_inicio yet, stamp it on the demand
    if (waMsgId) {
      await prisma.demanda.updateMany({
        where: { id: demandaId, wa_msg_id_inicio: null },
        data:  { wa_msg_id_inicio: waMsgId },
      })
    }

    const enviado = zapiResult !== null
    console.log(`[NotifWA] demanda=${demandaId} enviado=${enviado} waMsgId=${waMsgId ?? "-"}`)
    return { enviado, waMsgId }
  } catch (err) {
    console.error(`[NotifWA] Erro ao notificar demanda=${demandaId}:`, err)
    return { enviado: false }
  }
}

// ── Template helpers ──────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ""

// ── Public notification functions ─────────────────────────────────────────────

/** Called when a new demand is created. */
export async function notificarNovaDemanda(demandaId: string): Promise<void> {
  try {
    const demanda = await prisma.demanda.findUnique({
      where:  { id: demandaId },
      select: {
        id:         true,
        titulo:     true,
        descricao:  true,
        tipo:       true,
        prioridade: true,
        cliente_id: true,
        wa_msg_id_inicio: true,
      },
    })

    if (!demanda) return

    // Short ID — first 8 chars
    const idShort = demanda.id.replace(/-/g, "").slice(0, 8).toUpperCase()

    const mensagem =
      `🔔 *Nova Demanda Criada — #${idShort}*\n` +
      `📋 *${demanda.titulo}*\n` +
      `Tipo: ${TIPO_LABELS[demanda.tipo]}  |  Prioridade: ${PRIORIDADE_LABELS[demanda.prioridade]}\n\n` +
      `${truncate(demanda.descricao, 200)}\n\n` +
      `🔗 ${APP_URL}/portal/demandas/${demanda.id}\n\n` +
      `_Responda aqui ou acesse o portal. Para acionar o agente IA, mencione @agente._`

    await notificarDemandaWa({
      demandaId:    demanda.id,
      clienteId:    demanda.cliente_id,
      mensagem,
      replyToMsgId: demanda.wa_msg_id_inicio ?? undefined,
    })
  } catch (err) {
    console.error(`[NotifWA] notificarNovaDemanda demanda=${demandaId}:`, err)
  }
}

/** Called when demand status changes. */
export async function notificarStatusDemanda(
  demandaId: string,
  statusAnterior: string,
): Promise<void> {
  try {
    const demanda = await prisma.demanda.findUnique({
      where:  { id: demandaId },
      select: {
        id:               true,
        titulo:           true,
        status:           true,
        cliente_id:       true,
        resolvido_at:     true,
        wa_msg_id_inicio: true,
      },
    })

    if (!demanda) return

    const statusAnteriorLabel = STATUS_LABELS[statusAnterior as StatusDemanda] ?? statusAnterior
    const statusNovoLabel     = STATUS_LABELS[demanda.status]

    const resolvidoMsg =
      demanda.status === "concluida"
        ? "\n✅ Demanda marcada como *Concluída*. Obrigado pela parceria!"
        : ""

    const mensagem =
      `📊 *Atualização de Status*\n` +
      `Demanda: *${demanda.titulo}*\n` +
      `${statusAnteriorLabel} → *${statusNovoLabel}*` +
      resolvidoMsg

    await notificarDemandaWa({
      demandaId:    demanda.id,
      clienteId:    demanda.cliente_id,
      mensagem,
      replyToMsgId: demanda.wa_msg_id_inicio ?? undefined,
    })
  } catch (err) {
    console.error(`[NotifWA] notificarStatusDemanda demanda=${demandaId}:`, err)
  }
}

/** Called when a non-internal comment is added. */
export async function notificarComentarioDemanda(
  demandaId: string,
  comentarioTexto: string,
): Promise<void> {
  try {
    const demanda = await prisma.demanda.findUnique({
      where:  { id: demandaId },
      select: {
        id:               true,
        titulo:           true,
        cliente_id:       true,
        wa_msg_id_inicio: true,
      },
    })

    if (!demanda) return

    const mensagem =
      `💬 *Nova mensagem da equipe*\n` +
      `Demanda: *${demanda.titulo}*\n\n` +
      `"${truncate(comentarioTexto, 500)}"\n\n` +
      `_Responda aqui ou acesse o portal._`

    await notificarDemandaWa({
      demandaId:    demanda.id,
      clienteId:    demanda.cliente_id,
      mensagem,
      replyToMsgId: demanda.wa_msg_id_inicio ?? undefined,
    })
  } catch (err) {
    console.error(`[NotifWA] notificarComentarioDemanda demanda=${demandaId}:`, err)
  }
}
