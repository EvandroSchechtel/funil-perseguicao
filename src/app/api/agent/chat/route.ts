import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { badRequest, unauthorized } from "@/lib/api/response"
import { agentTools } from "@/lib/agent/tools"
import { executeTool } from "@/lib/agent/executor"
import { formatSSE, SSE_HEADERS } from "@/lib/agent/stream"
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/prompt"
import { prisma } from "@/lib/db/prisma"

const bodySchema = z.object({
  prompt: z.string().min(1).max(4000),
})

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctxResult = await getAuthContext(request)
  if ("error" in ctxResult) return ctxResult.error

  const { user } = ctxResult.context
  if (!process.env.ANTHROPIC_API_KEY) {
    return unauthorized("ANTHROPIC_API_KEY não configurada.")
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Body JSON inválido.")
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const { prompt } = parsed.data

  // ── Criar sessão no banco ─────────────────────────────────────────────────
  const sessao = await prisma.agentSessao.create({
    data: {
      usuario_id: user.id,
      prompt,
      status: "executando",
    },
  })

  // ── SSE stream ────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: Parameters<typeof formatSSE>[0]) => {
        controller.enqueue(new TextEncoder().encode(formatSSE(event)))
      }

      try {
        await runAgentLoop({ prompt, userId: user.id, sessaoId: sessao.id, emit })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro interno do agente."
        emit({ type: "error", message })
        await prisma.agentSessao.update({
          where: { id: sessao.id },
          data: { status: "erro" },
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}

// ── Agent loop ───────────────────────────────────────────────────────────────

interface LoopParams {
  prompt: string
  userId: string
  sessaoId: string
  emit: (event: Parameters<typeof formatSSE>[0]) => void
}

async function runAgentLoop({ prompt, userId, sessaoId, emit }: LoopParams) {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ]

  let ordem = 0
  let finalResponse = ""

  emit({ type: "thinking", content: "Analisando o que fazer..." })

  // Loop agentico: continua até Claude não chamar mais ferramentas
  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: AGENT_SYSTEM_PROMPT,
      tools: agentTools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
      messages,
    })

    // Separar blocos de texto e tool_use
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    )
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )

    // Emitir texto intermediário (quando há tool calls junto)
    if (textBlocks.length > 0 && toolUseBlocks.length > 0) {
      const text = textBlocks.map((b) => b.text).join("")
      emit({ type: "thinking", content: text })
    }

    // Sem mais tool calls → resposta final
    if (toolUseBlocks.length === 0) {
      finalResponse = textBlocks.map((b) => b.text).join("")
      emit({ type: "response", content: finalResponse })
      break
    }

    // Executar cada ferramenta
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUseBlocks) {
      const args = toolUse.input as Record<string, unknown>

      emit({ type: "tool_call", tool: toolUse.name, args })

      const result = await executeTool(toolUse.name, args, { userId })

      emit({
        type: "tool_result",
        tool: toolUse.name,
        ok: result.ok,
        data: result.data ?? null,
        error: result.error ?? null,
      })

      // Persistir ação no banco
      await prisma.agentAcao.create({
        data: {
          sessao_id: sessaoId,
          tool_name: toolUse.name,
          args: args as object,
          resultado: result.ok ? (result.data as object) : null,
          erro: result.error ?? null,
          ordem: ordem++,
        },
      })

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result.ok ? result.data : { error: result.error }),
      })
    }

    // Adicionar turno do assistente + resultados das ferramentas ao histórico
    messages.push({ role: "assistant", content: response.content })
    messages.push({ role: "user", content: toolResults })

    emit({ type: "thinking", content: "Processando resultados..." })
  }

  // Finalizar sessão
  await prisma.agentSessao.update({
    where: { id: sessaoId },
    data: { status: "concluido", resposta: finalResponse },
  })

  emit({ type: "done", sessao_id: sessaoId })
}
