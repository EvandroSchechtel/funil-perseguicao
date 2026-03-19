import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"

// GET /api/agent/sessoes/[id] — detalhes de uma sessão com suas ações
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    const { id } = await params

    const sessao = await prisma.agentSessao.findUnique({
      where: { id },
      include: {
        acoes: {
          orderBy: { ordem: "asc" },
        },
      },
    })

    if (!sessao) return notFound("Sessão não encontrada.")

    // Usuário só pode ver suas próprias sessões
    if (sessao.usuario_id !== user.id) return forbidden("Sem permissão.")

    return ok({ sessao })
  } catch (error) {
    console.error("[GET /api/agent/sessoes/[id]]", error)
    return serverError()
  }
}
