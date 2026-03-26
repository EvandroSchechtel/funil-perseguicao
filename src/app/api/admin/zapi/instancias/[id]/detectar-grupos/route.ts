import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { getGroupsAndCommunities } from "@/lib/zapi/client"
import { sincronizarGruposCache } from "@/lib/services/zapi.service"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/zapi/instancias/[id]/detectar-grupos[?refresh=true]
// Returns the cached list of WhatsApp groups for the UI picker.
// Only calls Z-API when ?refresh=true is passed or the cache is empty.
export const maxDuration = 60

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id } = await params
    const refresh = request.nextUrl.searchParams.get("refresh") === "true"

    const inst = await prisma.instanciaZApi.findFirst({
      where: { id, deleted_at: null },
      select: { instance_id: true, token: true, client_token: true },
    })
    if (!inst) return (await import("@/lib/api/response")).notFound("Instância não encontrada.")

    // Serve from cache unless forced refresh or cache is empty
    if (!refresh) {
      try {
        const cached = await prisma.grupoWaCache.findMany({
          where: { instancia_id: id },
          select: { grupo_wa_id: true, nome: true },
          orderBy: { nome: "asc" },
        })
        if (cached.length > 0) {
          return ok({
            grupos: cached.map((c) => ({ phone: c.grupo_wa_id, name: c.nome, isGroup: true })),
            from_cache: true,
          })
        }
      } catch {
        // Cache table may not exist yet — fall through to Z-API
      }
    }

    // Cache miss or forced refresh → call Z-API and persist
    const grupos = await getGroupsAndCommunities(inst.instance_id, inst.token, inst.client_token)
    try { await sincronizarGruposCache(id, grupos) } catch { /* best-effort */ }
    return ok({ grupos: grupos.filter((g) => g.name?.trim()), from_cache: false })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
