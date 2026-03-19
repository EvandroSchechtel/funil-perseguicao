/**
 * Agent Tool Registry
 *
 * Defines all tools available to the AI agent.
 * Each tool maps to a service function from src/lib/services/.
 * Format follows the Anthropic tool_use API schema.
 */

export interface AgentTool {
  name: string
  description: string
  input_schema: {
    type: "object"
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
      items?: { type: string }
    }>
    required: string[]
  }
}

export const agentTools: AgentTool[] = [
  // ─── DASHBOARD ────────────────────────────────────────────────────────────

  {
    name: "get_metricas",
    description: "Retorna as métricas do dashboard: leads de hoje, da semana, taxa de sucesso, falhas e fila. Use para responder perguntas sobre o estado geral do sistema.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ─── LEADS ────────────────────────────────────────────────────────────────

  {
    name: "listar_leads",
    description: "Lista leads com paginação e filtros. Use para buscar leads por status, webhook ou texto.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Página (padrão: 1)" },
        per_page: { type: "number", description: "Itens por página (padrão: 20, máx: 100)" },
        search: { type: "string", description: "Busca por nome, telefone ou email" },
        status: {
          type: "string",
          description: "Filtrar por status",
          enum: ["pendente", "processando", "sucesso", "falha", "todos"],
        },
        webhook_id: { type: "string", description: "Filtrar por ID do webhook" },
      },
      required: [],
    },
  },

  {
    name: "buscar_lead",
    description: "Busca os detalhes completos de um lead pelo ID, incluindo webhook e conta associados.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do lead" },
      },
      required: ["id"],
    },
  },

  {
    name: "reprocessar_lead",
    description: "Reenfileira um lead com status 'falha' para ser reprocessado no Manychat. O lead deve estar com status 'falha'.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do lead a reprocessar" },
      },
      required: ["id"],
    },
  },

  {
    name: "reprocessar_falhas",
    description: "Reenfileira em massa todos os leads com status 'falha'. Limite de 500 leads por vez. Opcionalmente filtra por webhook.",
    input_schema: {
      type: "object",
      properties: {
        webhook_id: { type: "string", description: "Filtrar por webhook (opcional — sem filtro reprocessa todos)" },
      },
      required: [],
    },
  },

  // ─── WEBHOOKS ─────────────────────────────────────────────────────────────

  {
    name: "listar_webhooks",
    description: "Lista os webhooks cadastrados com paginação e busca por nome ou flow_ns.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Página (padrão: 1)" },
        per_page: { type: "number", description: "Itens por página (padrão: 20)" },
        search: { type: "string", description: "Busca por nome ou flow_ns" },
      },
      required: [],
    },
  },

  {
    name: "buscar_webhook",
    description: "Busca os detalhes de um webhook pelo ID, incluindo URL pública e contagem de leads.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do webhook" },
      },
      required: ["id"],
    },
  },

  {
    name: "criar_webhook",
    description: "Cria um novo webhook vinculado a uma conta Manychat ativa e um flow do Manychat.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do webhook" },
        conta_id: { type: "string", description: "ID da conta Manychat (deve estar ativa)" },
        flow_ns: { type: "string", description: "Namespace do flow no Manychat (ex: content20240101120000_123456)" },
        flow_nome: { type: "string", description: "Nome amigável do flow (opcional)" },
        status: { type: "string", description: "Status inicial", enum: ["ativo", "inativo"] },
      },
      required: ["nome", "conta_id", "flow_ns"],
    },
  },

  {
    name: "atualizar_webhook",
    description: "Atualiza os dados de um webhook existente (nome, flow_ns, flow_nome ou status).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do webhook" },
        nome: { type: "string", description: "Novo nome" },
        flow_ns: { type: "string", description: "Novo flow_ns" },
        flow_nome: { type: "string", description: "Novo nome do flow" },
        status: { type: "string", description: "Novo status", enum: ["ativo", "inativo"] },
      },
      required: ["id"],
    },
  },

  {
    name: "toggle_webhook",
    description: "Ativa ou desativa um webhook (alterna entre ativo/inativo).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do webhook" },
      },
      required: ["id"],
    },
  },

  {
    name: "deletar_webhook",
    description: "Remove (soft delete) um webhook. Leads existentes são preservados.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do webhook a remover" },
      },
      required: ["id"],
    },
  },

  // ─── CONTAS MANYCHAT ──────────────────────────────────────────────────────

  {
    name: "listar_contas",
    description: "Lista as contas Manychat cadastradas com paginação e filtros.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Página (padrão: 1)" },
        per_page: { type: "number", description: "Itens por página (padrão: 20)" },
        search: { type: "string", description: "Busca por nome ou page_name" },
        status: { type: "string", description: "Filtrar por status", enum: ["ativo", "inativo"] },
      },
      required: [],
    },
  },

  {
    name: "buscar_conta",
    description: "Busca os detalhes de uma conta Manychat pelo ID.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID da conta" },
      },
      required: ["id"],
    },
  },

  {
    name: "testar_conta",
    description: "Testa a conexão com a API Manychat e sincroniza o nome da página. Use para verificar se uma conta está funcionando.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID da conta a testar" },
      },
      required: ["id"],
    },
  },

  {
    name: "toggle_conta",
    description: "Ativa ou desativa uma conta Manychat (alterna entre ativo/inativo).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID da conta" },
      },
      required: ["id"],
    },
  },

  // ─── USUÁRIOS ─────────────────────────────────────────────────────────────

  {
    name: "listar_usuarios",
    description: "Lista os usuários do sistema com paginação, busca e filtro por role. Apenas super_admin pode executar.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Página (padrão: 1)" },
        per_page: { type: "number", description: "Itens por página (padrão: 20)" },
        search: { type: "string", description: "Busca por nome ou email" },
        role: {
          type: "string",
          description: "Filtrar por role",
          enum: ["super_admin", "admin", "operador", "viewer", "all"],
        },
      },
      required: [],
    },
  },

  {
    name: "buscar_usuario",
    description: "Busca os detalhes de um usuário pelo ID. Apenas super_admin pode executar.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do usuário" },
      },
      required: ["id"],
    },
  },

  {
    name: "toggle_usuario",
    description: "Ativa ou desativa um usuário (alterna entre ativo/inativo). Não é possível desativar o único super_admin.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do usuário" },
      },
      required: ["id"],
    },
  },

  {
    name: "resetar_senha_usuario",
    description: "Gera uma senha temporária para o usuário e envia por email. O usuário será obrigado a trocar no próximo login.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do usuário" },
      },
      required: ["id"],
    },
  },
]

/** Retorna um tool pelo nome */
export function getToolByName(name: string): AgentTool | undefined {
  return agentTools.find((t) => t.name === name)
}

/** Lista apenas os nomes dos tools disponíveis */
export const toolNames = agentTools.map((t) => t.name)
