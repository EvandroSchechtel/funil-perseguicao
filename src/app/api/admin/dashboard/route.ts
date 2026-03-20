import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, badRequest } from "@/lib/api/response"
import {
  getMetricasGeral,
  getMetricasOperacional,
  getMetricasGrupos,
  type DashboardFilters,
} from "@/lib/services/dashboard.service"

function startOfDayBRT(date: Date): Date {
  // BRT = UTC-3; floor to day in BRT then return as UTC
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  brt.setUTCHours(0, 0, 0, 0)
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000)
}

function defaultFrom(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return startOfDayBRT(d)
}

// GET /api/admin/dashboard?section=geral|operacional|grupos&from=&to=&clienteId=&campanhaId=&contaId=
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "dashboard:read")) return forbidden("Sem permissão.")

    const { searchParams } = request.nextUrl

    const section = searchParams.get("section") ?? "geral"
    if (!["geral", "operacional", "grupos"].includes(section)) {
      return badRequest(`section inválido: ${section}`)
    }

    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    const from = fromParam ? new Date(fromParam) : defaultFrom()
    const to = toParam ? new Date(toParam) : new Date()

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return badRequest("Datas inválidas.")
    }

    const filters: DashboardFilters = {
      from,
      to,
      clienteId: searchParams.get("clienteId") ?? undefined,
      campanhaId: searchParams.get("campanhaId") ?? undefined,
      contaId: searchParams.get("contaId") ?? undefined,
    }

    // Remove empty strings
    if (!filters.clienteId) delete filters.clienteId
    if (!filters.campanhaId) delete filters.campanhaId
    if (!filters.contaId) delete filters.contaId

    if (section === "geral") {
      const result = await getMetricasGeral(filters)
      return ok(result)
    } else if (section === "operacional") {
      const result = await getMetricasOperacional(filters)
      return ok(result)
    } else {
      const result = await getMetricasGrupos(filters)
      return ok(result)
    }
  } catch (error) {
    console.error("[GET /api/admin/dashboard]", error)
    return serverError()
  }
}
