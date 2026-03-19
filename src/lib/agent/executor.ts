/**
 * Agent Tool Executor
 *
 * Executes agent tools by calling the corresponding service functions.
 * This is the bridge between the AI's tool calls and the business logic.
 *
 * Context required:
 *  - userId: the authenticated user making the request (for audit and created_by)
 *  - currentUserId: alias for userId, used in user management operations
 */

import * as leadsService from "@/lib/services/leads.service"
import * as webhooksService from "@/lib/services/webhooks.service"
import * as contasService from "@/lib/services/contas.service"
import * as usuariosService from "@/lib/services/usuarios.service"
import * as dashboardService from "@/lib/services/dashboard.service"

export interface ExecutorContext {
  userId: string
}

export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolArgs = Record<string, any>

export async function executeTool(
  toolName: string,
  args: ToolArgs,
  ctx: ExecutorContext
): Promise<ToolResult> {
  try {
    let data: unknown

    switch (toolName) {
      // ── Dashboard ──────────────────────────────────────────────────────────
      case "get_metricas":
        data = await dashboardService.getMetricas()
        break

      // ── Leads ──────────────────────────────────────────────────────────────
      case "listar_leads":
        data = await leadsService.listarLeads({
          page: args.page,
          perPage: args.per_page,
          search: args.search,
          status: args.status,
          webhookId: args.webhook_id,
        })
        break

      case "buscar_lead":
        data = await leadsService.buscarLead(args.id)
        break

      case "reprocessar_lead":
        data = await leadsService.reprocessarLead(args.id)
        break

      case "reprocessar_falhas":
        data = await leadsService.reprocessarFalhas(args.webhook_id)
        break

      // ── Webhooks ───────────────────────────────────────────────────────────
      case "listar_webhooks":
        data = await webhooksService.listarWebhooks({
          page: args.page,
          perPage: args.per_page,
          search: args.search,
        })
        break

      case "buscar_webhook":
        data = await webhooksService.buscarWebhook(args.id)
        break

      case "criar_webhook":
        data = await webhooksService.criarWebhook({
          nome: args.nome,
          campanha_id: args.campanha_id,
          status: args.status,
          userId: ctx.userId,
        })
        break

      case "atualizar_webhook":
        data = await webhooksService.atualizarWebhook(args.id, {
          nome: args.nome,
          campanha_id: args.campanha_id,
          status: args.status,
        })
        break

      case "toggle_webhook":
        data = await webhooksService.toggleWebhook(args.id)
        break

      case "deletar_webhook":
        data = await webhooksService.deletarWebhook(args.id)
        break

      // ── Contas Manychat ────────────────────────────────────────────────────
      case "listar_contas":
        data = await contasService.listarContas({
          page: args.page,
          perPage: args.per_page,
          search: args.search,
          status: args.status,
        })
        break

      case "buscar_conta":
        data = await contasService.buscarConta(args.id)
        break

      case "testar_conta":
        data = await contasService.testarConta(args.id)
        break

      case "toggle_conta":
        data = await contasService.toggleConta(args.id)
        break

      // ── Usuários ───────────────────────────────────────────────────────────
      case "listar_usuarios":
        data = await usuariosService.listarUsuarios({
          page: args.page,
          perPage: args.per_page,
          search: args.search,
          role: args.role,
        })
        break

      case "buscar_usuario":
        data = await usuariosService.buscarUsuario(args.id)
        break

      case "toggle_usuario":
        data = await usuariosService.toggleUsuario(args.id, ctx.userId)
        break

      case "resetar_senha_usuario":
        data = await usuariosService.resetarSenha(args.id)
        break

      default:
        return { ok: false, error: `Ferramenta desconhecida: "${toolName}"` }
    }

    return { ok: true, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido"
    return { ok: false, error: message }
  }
}
