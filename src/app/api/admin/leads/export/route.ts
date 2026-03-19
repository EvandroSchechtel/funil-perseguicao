import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { exportarLeads } from "@/lib/services/leads.service"

// GET /api/admin/leads/export — download CSV with current filters
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "dados:export")) {
      return new NextResponse("Sem permissão.", { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const csv = await exportarLeads({
      search: searchParams.get("q") || "",
      status: searchParams.get("status") || undefined,
      webhookId: searchParams.get("webhook_id") || undefined,
    })

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
      },
    })
  } catch (error) {
    console.error("[GET /api/admin/leads/export]", error)
    return new NextResponse("Erro interno.", { status: 500 })
  }
}
