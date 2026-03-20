export type Role = "super_admin" | "admin" | "operador" | "viewer" | "cliente"

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
  | "portal:read"
  | "demandas:write"
  | "demandas:read"
  | "demandas:manage"  // admin: atribuir, alterar status, ver comentários internos

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
    "demandas:read",
    "demandas:write",
    "demandas:manage",
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
    "demandas:read",
    "demandas:write",
    "demandas:manage",
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
    "demandas:read",
  ],
  viewer: [
    "clientes:read",
    "contas:read",
    "campanhas:read",
    "leads:read",
    "dashboard:read",
    "demandas:read",
  ],
  cliente: [
    "portal:read",
    "demandas:read",
    "demandas:write",
  ],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function isClienteRole(role: Role): boolean {
  return role === "cliente"
}

export function isAdminRole(role: Role): boolean {
  return ["super_admin", "admin", "operador", "viewer"].includes(role)
}

// Roles in hierarchical order (higher index = less privileged)
export const ROLES: Role[] = ["super_admin", "admin", "operador", "viewer"]
export const ROLES_ADMIN: Role[] = ["super_admin", "admin", "operador", "viewer"]

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    operador: "Operador",
    viewer: "Viewer",
    cliente: "Cliente",
  }
  return labels[role] || role
}

export function getRoleDescription(role: Role): string {
  const descriptions: Record<Role, string> = {
    super_admin: "Acesso total ao sistema, incluindo gerenciamento de usuários.",
    admin: "Gerencia clientes, contas e webhooks. Não gerencia usuários.",
    operador: "Cria webhooks, visualiza métricas e re-processa leads.",
    viewer: "Acesso somente leitura a dashboards, métricas e logs.",
    cliente: "Acesso ao portal do cliente — dashboard e demandas.",
  }
  return descriptions[role] || ""
}
