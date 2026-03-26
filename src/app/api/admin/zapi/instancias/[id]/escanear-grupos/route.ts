import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { getGroupsAndCommunities, getGroupMetadata } from "@/lib/zapi/client"
import { escanearEAutoVincular } from "@/lib/services/grupo-auto-vincular.service"
import { sincronizarGruposCache } from "@/lib/services/zapi.service"
import { processarParticipantesDoGrupo } from "@/lib/services/entradas.service"

// Allows time for paginated group fetching + participant processing across large accounts
export const maxDuration = 300

type Ctx = { params: Promise<{ id: string }> }

// POST /api/admin/zapi/instancias/[id]/escanear-grupos
// Fetches all Z-API groups, auto-links similar ones, then processes current participants
// of every configured group (creates EntradaGrupo + tags in Manychat).
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id } = await params
    const inst = await prisma.instanciaZApi.findFirst({
      where: { id, deleted_at: null },
      select: { instance_id: true, token: true, client_token: true },
    })
    if (!inst) return (await import("@/lib/api/response")).notFound("Instância não encontrada.")

    const grupos = await getGroupsAndCommunities(inst.instance_id, inst.token, inst.client_token)
    try { await sincronizarGruposCache(id, grupos) } catch { /* best-effort */ }
    const result = await escanearEAutoVincular(id, grupos)

    // Process current participants of all configured groups that have a grupo_wa_id
    const gruposAtivos = await prisma.grupoMonitoramento.findMany({
      where: { instancia_id: id, status: "ativo", grupo_wa_id: { not: null } },
      include: {
        conta_manychat: { select: { id: true, api_key: true } },
        contas_monitoramento: {
          include: { conta_manychat: { select: { id: true, api_key: true } } },
        },
      },
    })

    let entradas_processadas = 0
    let erros_entradas = 0

    for (const grupo of gruposAtivos) {
      const metadata = await getGroupMetadata(
        inst.instance_id, inst.token, inst.client_token, grupo.grupo_wa_id!
      ).catch(() => null)
      if (!metadata?.participants?.length) continue
      const stats = await processarParticipantesDoGrupo(grupo, metadata.participants)
      entradas_processadas += stats.processados
      erros_entradas += stats.erros
    }

    return ok({ ...result, entradas_processadas, erros_entradas })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
