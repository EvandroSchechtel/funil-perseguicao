export type Role = "super_admin" | "admin" | "operador" | "viewer"

type Permission =
  | "usuarios:manage"
  | "clientes:write"
  | "clientes:read"
  | "contas:write"
  | "contas:read"
  | "webhooks:write"
  | "webhooks:toggle"
  | "webhooks:delete"
  | "campanhas:write"
  | "campanhas:read"
  | "leads:reprocess"
  | "leads:read"
  | "api_keys:reveal"
  | "dados:export"
  | "dashboard:read"
  | "sistema:config"

const rolePermissions: Record<Role, Permission[]> = {
  super_admin: [
    "usuarios:manage",
    "clientes:write",
    "clientes:read",
    "contas:write",
    "contas:read",
    "webhooks:write",
    "webhooks:toggle",
    "webhooks:delete",
    "campanhas:write",
    "campanhas:read",
    "leads:reprocess",
    "leads:read",
    "api_keys:reveal",
    "dados:export",
    "dashboard:read",
    "sistema:config",
  ],
  admin: [
    "clientes:write",
    "clientes:read",
    "contas:write",
    "contas:read",
    "webhooks:write",
    "webhooks:toggle",
    "webhooks:delete",
    "campanhas:write",
    "campanhas:read",
    "leads:reprocess",
    "leads:read",
    "api_keys:reveal",
    "dados:export",
    "dashboard:read",
  ],
  operador: [
    "clientes:read",
    "contas:read",
    "webhooks:write",
    "webhooks:toggle",
    "campanhas:write",
    "campanhas:read",
    "leads:reprocess",
    "leads:read",
    "dados:export",
    "dashboard:read",
  ],
  viewer: [
    "clientes:read",
    "contas:read",
    "campanhas:read",
    "leads:read",
    "dashboard:read",
  ],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    operador: "Operador",
    viewer: "Viewer",
  }
  return labels[role] || role
}

export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    super_admin: "Acesso total ao sistema, incluindo gerenciamento de usuários.",
    admin: "Gerencia clientes, contas e webhooks. Não gerencia usuários.",
    operador: "Cria webhooks, visualiza métricas e re-processa leads.",
    viewer: "Acesso somente leitura a dashboards, métricas e logs.",
  }
  return descriptions[role] || ""
}

// Roles in hierarchical order (higher index = less privileged)
export const ROLES: Role[] = ["super_admin", "admin", "operador", "viewer"]
