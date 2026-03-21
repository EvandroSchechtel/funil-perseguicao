import { prisma } from "@/lib/db/prisma"
import { normalizePhone, getParticipantPhone, type ZApiWebhookPayload } from "@/lib/zapi/client"

/**
 * Core logic: processes a Z-API GROUP_PARTICIPANT_REMOVE event.
 *
 * Steps:
 * 1. Find active GrupoMonitoramento matching chatName (case-insensitive) or grupo_wa_id
 * 2. Normalize participant phone
 * 3. Find existing Contato and Lead (never creates new records)
 * 4. Insert SaidaGrupo record
 */
export async function processarSaidaGrupo(
  instanciaId: string,
  payload: ZApiWebhookPayload
): Promise<void> {
  const { phone, chatId, chatName = "", senderName } = payload
  const participantPhone = getParticipantPhone(payload)

  // Z-API may send the group ID in either `phone` or `chatId`
  const groupWaId = phone || chatId || ""

  const telefoneNorm = normalizePhone(participantPhone)
  if (!telefoneNorm) {
    console.warn("[Saidas] participantPhone vazio — ignorando")
    return
  }

  // 1. Find all active grupos for this instância
  const grupos = await prisma.grupoMonitoramento.findMany({
    where: { instancia_id: instanciaId, status: "ativo" },
  })

  // 2. Match by grupo_wa_id (exact) or nome_filtro (contains)
  const matched = grupos.filter(
    (g) =>
      (groupWaId && g.grupo_wa_id === groupWaId) ||
      chatName.toLowerCase().includes(g.nome_filtro.toLowerCase())
  )

  if (matched.length === 0) {
    console.log(`[Saidas] Nenhum grupo monitorado corresponde a "${chatName}"`)
    return
  }

  console.log(
    `[Saidas] ${matched.length} grupo(s) correspondem a "${chatName}" para telefone ${telefoneNorm}`
  )

  for (const grupo of matched) {
    try {
      // Save grupo_wa_id on first match
      if (!grupo.grupo_wa_id && groupWaId) {
        await prisma.grupoMonitoramento
          .update({ where: { id: grupo.id }, data: { grupo_wa_id: groupWaId } })
          .catch(() => {})
      }

      // 3. Find existing Contato (don't create if absent)
      const contato = await prisma.contato.findFirst({
        where: {
          OR: [
            { telefone: telefoneNorm },
            { telefone: `+${telefoneNorm}` },
            ...(telefoneNorm.startsWith("55") ? [{ telefone: telefoneNorm.slice(2) }] : []),
          ],
        },
        select: { id: true },
      })

      // 4. Find existing Lead
      let leadId: string | null = null
      if (contato) {
        const lead = await prisma.lead.findFirst({
          where: { contato_id: contato.id, campanha_id: grupo.campanha_id },
          select: { id: true },
        })
        leadId = lead?.id ?? null
      }

      // 5. Upsert SaidaGrupo (re-saída atualiza timestamp, sem duplicar)
      await prisma.saidaGrupo.upsert({
        where: { grupo_id_telefone: { grupo_id: grupo.id, telefone: telefoneNorm } },
        create: {
          grupo_id: grupo.id,
          lead_id: leadId,
          telefone: telefoneNorm,
          nome_whatsapp: senderName ?? null,
        },
        update: {
          lead_id: leadId,
          nome_whatsapp: senderName ?? null,
          saiu_at: new Date(),
        },
      })

      // 6. Update Lead.grupo_saiu_at
      if (leadId) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { grupo_saiu_at: new Date() },
        })
        console.log(`[Saidas] Lead ${leadId} marcado como saiu_grupo`)
      }

      console.log(`[Saidas] Saída registrada grupo=${grupo.id} telefone=${telefoneNorm}`)
    } catch (err) {
      console.error(`[Saidas] Erro processando grupo ${grupo.id}:`, err)
    }
  }
}
