import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { isGroupJoinEvent, isGroupExitEvent, type ZApiWebhookPayload } from "@/lib/zapi/client"
import { addGrupoEventoJob } from "@/lib/queue/queues"

// Always return 200 to Z-API — never 4xx/5xx to avoid retry storms
function ok() {
  return NextResponse.json({ ok: true }, { status: 200 })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Resolves the group chat ID from a Z-API payload. */
function getGroupChatId(payload: ZApiWebhookPayload): string | null {
  // Z-API sends the group ID in chatId (format: "...@g.us") or in phone
  if (payload.chatId && payload.chatId.endsWith("@g.us")) return payload.chatId
  if (payload.phone && payload.phone.endsWith("@g.us")) return payload.phone
  return null
}

/** Returns true if the payload is an incoming text message in a group. */
function isGroupTextMessage(payload: ZApiWebhookPayload): boolean {
  return (
    payload.isGroup === true &&
    typeof payload.text?.message === "string" &&
    payload.text.message.length > 0
  )
}

// ── Case A: reply from client in a demand group ────────────────────────────────

async function handleGroupReply(
  payload: ZApiWebhookPayload,
  chatId: string,
): Promise<void> {
  try {
    // Find the cliente whose grupo_wa_id matches this chat
    const cliente = await prisma.cliente.findFirst({
      where:  { grupo_wa_id: chatId, deleted_at: null },
      select: { id: true },
    })
    if (!cliente) return

    // Find latest open demand for this cliente
    const demanda = await prisma.demanda.findFirst({
      where: {
        cliente_id: cliente.id,
        status:     { notIn: ["concluida", "cancelada"] },
      },
      orderBy: { created_at: "desc" },
      select:  { id: true, criado_por: true },
    })
    if (!demanda) return

    const texto       = payload.text!.message!
    const autorNome   = payload.senderName  ?? payload.chatName ?? "Cliente"
    const autorWaId   = payload.senderPhone ?? payload.participantPhone ?? payload.phone ?? ""
    const waMsgId     = payload.messageId   ?? payload.zaapId ?? undefined

    // Create comment (intern=false, mapped to demand creator since we lack WA→user mapping)
    await prisma.comentarioDemanda.create({
      data: {
        demanda_id: demanda.id,
        autor_id:   demanda.criado_por,
        texto,
        interno:    false,
      },
    })

    // Log WA message
    await prisma.mensagemWaDemanda.create({
      data: {
        demanda_id:  demanda.id,
        direcao:     "entrada",
        texto,
        autor_nome:  autorNome,
        autor_wa_id: autorWaId || null,
        wa_msg_id:   waMsgId ?? null,
      },
    })

    console.log(
      `[ZApi Webhook] Grupo reply demanda=${demanda.id} cliente=${cliente.id} autor="${autorNome}"`,
    )
  } catch (err) {
    console.error("[ZApi Webhook] handleGroupReply error:", err)
  }
}

// ── Case B: @agente mention ────────────────────────────────────────────────────

async function handleAgenteMention(
  payload: ZApiWebhookPayload,
  chatId: string,
): Promise<void> {
  try {
    const mensagem  = payload.text!.message!
    const autorWaId = payload.senderPhone ?? payload.participantPhone ?? payload.phone ?? ""
    const waMsgId   = payload.messageId   ?? payload.zaapId ?? ""

    // Find the cliente whose grupo_wa_id matches this chat
    const cliente = await prisma.cliente.findFirst({
      where:  { grupo_wa_id: chatId, deleted_at: null },
      select: { id: true },
    })

    // Find latest open demand (optional link)
    let demandaId: string | null = null
    if (cliente) {
      const demanda = await prisma.demanda.findFirst({
        where: {
          cliente_id: cliente.id,
          status:     { notIn: ["concluida", "cancelada"] },
        },
        orderBy: { created_at: "desc" },
        select:  { id: true },
      })
      demandaId = demanda?.id ?? null
    }

    await prisma.gatilhoAgente.create({
      data: {
        grupo_wa_id: chatId,
        mensagem,
        autor_wa_id: autorWaId,
        wa_msg_id:   waMsgId,
        status:      "pendente",
        demanda_id:  demandaId,
      },
    })

    console.log(
      `[ZApi Webhook] @agente trigger chatId=${chatId} demanda=${demandaId ?? "-"}`,
    )
  } catch (err) {
    console.error("[ZApi Webhook] handleAgenteMention error:", err)
  }
}

// ── Route handlers ─────────────────────────────────────────────────────────────

// POST /api/webhook/zapi/[token]
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // 1. Validate token → find instância
  const instancia = await prisma.instanciaZApi.findFirst({
    where: { webhook_token: token, status: "ativo", deleted_at: null },
    select: { id: true, client_token: true },
  })

  if (!instancia) {
    // Return 200 anyway — don't reveal if token is invalid
    console.warn(`[ZApi Webhook] Unknown token: ${token}`)
    return ok()
  }

  // 2. Parse body safely
  let payload: ZApiWebhookPayload
  try {
    payload = await request.json()
  } catch {
    console.warn("[ZApi Webhook] Invalid JSON body")
    return ok()
  }

  console.log(
    `[ZApi Webhook] instancia=${instancia.id} type=${payload.type} ` +
    `notification=${payload.notification ?? "-"} isGroup=${payload.isGroup}`,
  )

  // 3. Handle incoming group text messages (Cases A & B) — best-effort, fire-and-forget
  if (isGroupTextMessage(payload)) {
    const chatId = getGroupChatId(payload)
    if (chatId) {
      const msgText = payload.text!.message!

      // Case A: any message in a known demand group → log as reply
      handleGroupReply(payload, chatId).catch((err) =>
        console.error("[ZApi Webhook] handleGroupReply unhandled:", err),
      )

      // Case B: @agente mention
      if (/\@agente/i.test(msgText)) {
        handleAgenteMention(payload, chatId).catch((err) =>
          console.error("[ZApi Webhook] handleAgenteMention unhandled:", err),
        )
      }
    }
  }

  // 4. GROUP_PARTICIPANT_ADD — enqueue entry (retry + dedup via BullMQ)
  if (isGroupJoinEvent(payload)) {
    await addGrupoEventoJob({ tipo: "entrada", instanciaId: instancia.id, payload })
  }

  // 5. GROUP_PARTICIPANT_REMOVE / LEAVE — enqueue exit (retry + dedup via BullMQ)
  if (isGroupExitEvent(payload)) {
    await addGrupoEventoJob({ tipo: "saida", instanciaId: instancia.id, payload })
  }

  return ok()
}

// Z-API may send GET to validate the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 })
}
