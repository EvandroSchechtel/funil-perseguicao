import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { forbidden, serverError } from "@/lib/api/response"
import { exportarContatos } from "@/lib/services/contatos.service"

// GET /api/admin/contatos/export
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "dados:export")) return forbidden("Sem permissão.")

    const { searchParams } = new URL(request.url)
    const csv = await exportarContatos(searchParams.get("search") || undefined)

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contatos-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error("[GET /api/admin/contatos/export]", error)
    return serverError()
  }
}
