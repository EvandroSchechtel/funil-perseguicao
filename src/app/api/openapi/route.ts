import { NextResponse } from "next/server"

/**
 * GET /api/openapi
 * Returns an OpenAPI 3.1 specification of all admin endpoints.
 * Used by MCP agents / AI assistants to discover and invoke API actions.
 */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://funil-perseguicao.up.railway.app"

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Funil Perseguição API",
      version: "1.0.0",
      description:
        "API de gestão de campanhas, leads, webhooks, clientes, instâncias Z-API e contas Manychat. Todos os endpoints /api/admin/* requerem autenticação Bearer JWT.",
    },
    servers: [{ url: appUrl }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Token JWT obtido em POST /api/auth/login",
        },
      },
      schemas: {
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer" },
            per_page: { type: "integer" },
            total: { type: "integer" },
            total_pages: { type: "integer" },
          },
        },
        Error: {
          type: "object",
          properties: {
            message: { type: "string" },
            errors: { type: "object" },
          },
        },
      },
    },
    paths: {
      // ── Auth ──────────────────────────────────────────────────────────────
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login — obtém access token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "senha"],
                  properties: {
                    email: { type: "string", format: "email" },
                    senha: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Login bem-sucedido, retorna access_token e user" },
            "401": { description: "Credenciais inválidas" },
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Renova o access token via refresh cookie",
          responses: {
            "200": { description: "Novo access_token" },
            "401": { description: "Refresh token inválido ou expirado" },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Invalida o refresh token e faz logout",
          responses: { "200": { description: "Logout realizado" } },
        },
      },

      // ── Clientes ──────────────────────────────────────────────────────────
      "/api/admin/clientes": {
        get: {
          tags: ["Clientes"],
          summary: "Listar clientes",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "per_page", in: "query", schema: { type: "integer", default: 20 } },
            { name: "q", in: "query", schema: { type: "string" }, description: "Busca por nome" },
            { name: "status", in: "query", schema: { type: "string", enum: ["ativo", "inativo"] } },
          ],
          responses: { "200": { description: "Lista de clientes + pagination" } },
        },
        post: {
          tags: ["Clientes"],
          summary: "Criar cliente",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nome"],
                  properties: {
                    nome: { type: "string" },
                    email: { type: "string", format: "email" },
                    telefone: { type: "string" },
                    status: { type: "string", enum: ["ativo", "inativo"] },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Cliente criado" } },
        },
      },
      "/api/admin/clientes/{id}": {
        get: {
          tags: ["Clientes"],
          summary: "Buscar cliente por ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Dados do cliente" }, "404": { description: "Não encontrado" } },
        },
        patch: {
          tags: ["Clientes"],
          summary: "Atualizar cliente",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nome: { type: "string" },
                    email: { type: "string" },
                    telefone: { type: "string" },
                    status: { type: "string", enum: ["ativo", "inativo"] },
                    instancia_notif_id: { type: "string", nullable: true },
                    grupo_wa_id: { type: "string", nullable: true },
                    tag_wa_id: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Cliente atualizado" } },
        },
        delete: {
          tags: ["Clientes"],
          summary: "Deletar cliente (soft delete)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Cliente removido" } },
        },
      },

      // ── Campanhas ─────────────────────────────────────────────────────────
      "/api/admin/campanhas": {
        get: {
          tags: ["Campanhas"],
          summary: "Listar campanhas",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "per_page", in: "query", schema: { type: "integer", default: 20 } },
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["ativo", "inativo"] } },
          ],
          responses: { "200": { description: "Lista de campanhas + pagination" } },
        },
        post: {
          tags: ["Campanhas"],
          summary: "Criar campanha (gera webhook automaticamente)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nome"],
                  properties: {
                    nome: { type: "string" },
                    descricao: { type: "string", nullable: true },
                    data_inicio: { type: "string", format: "date-time", nullable: true },
                    data_fim: { type: "string", format: "date-time", nullable: true },
                    status: { type: "string", enum: ["ativo", "inativo"], default: "ativo" },
                    cliente_id: { type: "string", format: "uuid", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Campanha criada. Retorna data (campanha) + webhook { id, url_publica }",
            },
          },
        },
      },
      "/api/admin/campanhas/{id}": {
        get: {
          tags: ["Campanhas"],
          summary: "Buscar campanha por ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Dados da campanha" } },
        },
        patch: {
          tags: ["Campanhas"],
          summary: "Atualizar campanha",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nome: { type: "string" },
                    descricao: { type: "string", nullable: true },
                    data_inicio: { type: "string", format: "date-time", nullable: true },
                    data_fim: { type: "string", format: "date-time", nullable: true },
                    status: { type: "string", enum: ["ativo", "inativo"] },
                    cliente_id: { type: "string", format: "uuid", nullable: true },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Campanha atualizada" } },
        },
        delete: {
          tags: ["Campanhas"],
          summary: "Deletar campanha (soft delete)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Campanha removida" } },
        },
      },
      "/api/admin/campanhas/{id}/toggle": {
        post: {
          tags: ["Campanhas"],
          summary: "Alternar status ativo/inativo da campanha",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Status alternado" } },
        },
      },

      // ── Webhooks ──────────────────────────────────────────────────────────
      "/api/admin/webhooks": {
        get: {
          tags: ["Webhooks"],
          summary: "Listar webhooks",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "per_page", in: "query", schema: { type: "integer" } },
            { name: "campanha_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["ativo", "inativo"] } },
          ],
          responses: { "200": { description: "Lista de webhooks" } },
        },
      },
      "/api/admin/webhooks/{id}": {
        get: {
          tags: ["Webhooks"],
          summary: "Buscar webhook por ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Dados do webhook incluindo flows e url_publica" } },
        },
        patch: {
          tags: ["Webhooks"],
          summary: "Atualizar webhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Webhook atualizado" } },
        },
        delete: {
          tags: ["Webhooks"],
          summary: "Deletar webhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Webhook removido" } },
        },
      },
      "/api/admin/webhooks/{id}/toggle": {
        post: {
          tags: ["Webhooks"],
          summary: "Alternar status ativo/inativo do webhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Status alternado" } },
        },
      },
      "/api/admin/webhooks/{id}/flows": {
        get: {
          tags: ["Webhooks"],
          summary: "Listar flows do webhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Lista de flows" } },
        },
        post: {
          tags: ["Webhooks"],
          summary: "Adicionar flow ao webhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nome", "flow_ns"],
                  properties: {
                    nome: { type: "string" },
                    flow_ns: { type: "string", description: "Namespace do flow Manychat" },
                    conta_manychat_id: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Flow adicionado" } },
        },
      },

      // ── Leads ─────────────────────────────────────────────────────────────
      "/api/admin/leads": {
        get: {
          tags: ["Leads"],
          summary: "Listar leads",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "per_page", in: "query", schema: { type: "integer" } },
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "campanha_id", in: "query", schema: { type: "string", format: "uuid" } },
          ],
          responses: { "200": { description: "Lista de leads + pagination" } },
        },
      },
      "/api/admin/leads/{id}": {
        get: {
          tags: ["Leads"],
          summary: "Buscar lead por ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Dados do lead" } },
        },
      },
      "/api/admin/leads/{id}/reprocessar": {
        post: {
          tags: ["Leads"],
          summary: "Reprocessar lead individualmente",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Lead reprocessado" } },
        },
      },
      "/api/admin/leads/reprocessar-falhas": {
        post: {
          tags: ["Leads"],
          summary: "Reprocessar todos os leads com falha",
          responses: { "200": { description: "Leads em falha enfileirados para reprocessamento" } },
        },
      },

      // ── Contas Manychat ───────────────────────────────────────────────────
      "/api/admin/contas": {
        get: {
          tags: ["Manychat"],
          summary: "Listar contas Manychat",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "cliente_id", in: "query", schema: { type: "string", format: "uuid" } },
          ],
          responses: { "200": { description: "Lista de contas" } },
        },
        post: {
          tags: ["Manychat"],
          summary: "Criar conta Manychat",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nome", "api_key"],
                  properties: {
                    nome: { type: "string" },
                    api_key: { type: "string", description: "API Key do Manychat" },
                    field_id_whatsapp: { type: "string", description: "ID do custom field [esc]whatsapp-id" },
                    cliente_id: { type: "string", format: "uuid", nullable: true },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Conta criada" } },
        },
      },
      "/api/admin/contas/testar-key": {
        post: {
          tags: ["Manychat"],
          summary: "Testar API key Manychat antes de salvar",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["api_key"],
                  properties: { api_key: { type: "string" } },
                },
              },
            },
          },
          responses: {
            "200": { description: "API key válida, retorna nome da conta" },
            "400": { description: "API key inválida" },
          },
        },
      },
      "/api/admin/contas/{id}/testar": {
        post: {
          tags: ["Manychat"],
          summary: "Testar conectividade de conta Manychat salva",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Teste realizado" } },
        },
      },
      "/api/admin/contas/{id}/toggle": {
        post: {
          tags: ["Manychat"],
          summary: "Alternar status ativo/inativo da conta Manychat",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Status alternado" } },
        },
      },

      // ── Z-API Instâncias ──────────────────────────────────────────────────
      "/api/admin/zapi/instancias": {
        get: {
          tags: ["Z-API"],
          summary: "Listar instâncias Z-API",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer" } },
            { name: "cliente_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["ativo", "inativo"] } },
          ],
          responses: { "200": { description: "Lista de instâncias" } },
        },
        post: {
          tags: ["Z-API"],
          summary: "Criar instância Z-API",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nome", "instance_id", "token", "cliente_id"],
                  properties: {
                    nome: { type: "string" },
                    instance_id: { type: "string" },
                    token: { type: "string" },
                    client_token: { type: "string" },
                    cliente_id: { type: "string", format: "uuid", description: "Imutável após criação" },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Instância criada" } },
        },
      },
      "/api/admin/zapi/instancias/{id}": {
        get: {
          tags: ["Z-API"],
          summary: "Buscar instância Z-API por ID",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Dados da instância" } },
        },
        put: {
          tags: ["Z-API"],
          summary: "Atualizar instância Z-API (cliente_id não pode ser alterado)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    nome: { type: "string" },
                    instance_id: { type: "string" },
                    token: { type: "string" },
                    client_token: { type: "string" },
                    status: { type: "string", enum: ["ativo", "inativo"] },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Instância atualizada" } },
        },
        delete: {
          tags: ["Z-API"],
          summary: "Deletar instância Z-API",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Instância removida" } },
        },
      },
      "/api/admin/zapi/instancias/{id}/detectar-grupos": {
        post: {
          tags: ["Z-API"],
          summary: "Detectar grupos WhatsApp via Z-API",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "Lista de grupos detectados: [{ id, name, participants }]",
            },
          },
        },
      },
      "/api/admin/zapi/instancias/{id}/tags-manychat": {
        get: {
          tags: ["Z-API"],
          summary: "Listar tags Manychat da conta vinculada ao cliente da instância",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "conta_id", in: "query", schema: { type: "string", format: "uuid" } },
          ],
          responses: { "200": { description: "Lista de tags: [{ id, name }]" } },
        },
      },
      "/api/admin/zapi/instancias/{id}/grupos": {
        get: {
          tags: ["Z-API"],
          summary: "Listar grupos de monitoramento da instância",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": { description: "Lista de grupos de monitoramento" } },
        },
        post: {
          tags: ["Z-API"],
          summary: "Criar grupo de monitoramento na instância",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["grupo_id", "grupo_nome", "conta_manychat_id", "tag_id", "tag_nome"],
                  properties: {
                    grupo_id: { type: "string" },
                    grupo_nome: { type: "string" },
                    conta_manychat_id: { type: "string", format: "uuid" },
                    tag_id: { type: "integer" },
                    tag_nome: { type: "string" },
                    nome_filtro: { type: "string" },
                    campanha_id: { type: "string", format: "uuid", nullable: true },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Grupo de monitoramento criado" } },
        },
      },

      // ── Dashboard ─────────────────────────────────────────────────────────
      "/api/admin/dashboard": {
        get: {
          tags: ["Dashboard"],
          summary: "Resumo do dashboard (métricas gerais)",
          parameters: [
            { name: "campanha_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "cliente_id", in: "query", schema: { type: "string", format: "uuid" } },
          ],
          responses: { "200": { description: "Métricas de leads, campanhas e webhooks" } },
        },
      },

      // ── Usuários ──────────────────────────────────────────────────────────
      "/api/admin/usuarios": {
        get: {
          tags: ["Usuários"],
          summary: "Listar usuários (super_admin only)",
          responses: { "200": { description: "Lista de usuários" } },
        },
        post: {
          tags: ["Usuários"],
          summary: "Criar usuário (super_admin only)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["nome", "email", "senha", "role"],
                  properties: {
                    nome: { type: "string" },
                    email: { type: "string", format: "email" },
                    senha: { type: "string" },
                    role: { type: "string", enum: ["super_admin", "admin", "operador", "viewer", "cliente"] },
                  },
                },
              },
            },
          },
          responses: { "201": { description: "Usuário criado" } },
        },
      },
    },
  }

  return NextResponse.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
