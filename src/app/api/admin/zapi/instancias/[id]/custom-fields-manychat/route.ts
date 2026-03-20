import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/zapi/instancias/[id]/custom-fields-manychat?conta_id=<contaManychatId>
// Returns Manychat custom fields for the UI field picker
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    await params // consume params (not needed for this route)

    const contaId = request.nextUrl.searchParams.get("conta_id")
    if (!contaId) return ok({ fields: [] })

    const conta = await prisma.contaManychat.findFirst({
      where: { id: contaId, deleted_at: null },
      select: { api_key: true },
    })
    if (!conta) return ok({ fields: [] })

    const res = await fetch("https://api.manychat.com/fb/page/getCustomFields", {
      headers: { Authorization: `Bearer ${conta.api_key}`, "Content-Type": "application/json" },
    })
    if (!res.ok) return ok({ fields: [] })

    const data = await res.json()
    if (data.status !== "success" || !Array.isArray(data.data)) return ok({ fields: [] })

    const fields = data.data.map((f: Record<string, unknown>) => ({
      id: Number(f.id),
      name: String(f.name),
      type: String(f.type ?? ""),
    }))

    return ok({ fields })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
