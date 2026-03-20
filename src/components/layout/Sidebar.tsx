"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Webhook, Users2, Zap, Shield, User, LogOut, Bot, Megaphone, Building2, Contact, Activity, MessageSquare, FileText, Rocket } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Role } from "@/lib/auth/rbac"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  requiredRoles?: Role[]
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Implantação",
    href: "/admin/implantacao",
    icon: <Rocket className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin"],
  },
  {
    label: "Clientes",
    href: "/admin/clientes",
    icon: <Building2 className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
  {
    label: "Campanhas",
    href: "/admin/campanhas",
    icon: <Megaphone className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
  {
    label: "Demandas",
    href: "/admin/demandas",
    icon: <FileText className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
  {
    label: "Leads",
    href: "/admin/leads",
    icon: <Users2 className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
  {
    label: "Contatos",
    href: "/admin/contatos",
    icon: <Contact className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
  {
    label: "Fila",
    href: "/admin/fila",
    icon: <Activity className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin"],
  },
  {
    label: "Z-API",
    href: "/admin/zapi",
    icon: <Zap className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin"],
  },
  {
    label: "Usuários",
    href: "/admin/usuarios",
    icon: <Shield className="w-5 h-5" />,
    requiredRoles: ["super_admin"],
  },
  {
    label: "Agente IA",
    href: "/admin/agente",
    icon: <Bot className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
]

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operador: "Operador",
  viewer: "Viewer",
  cliente: "Cliente",
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  const visibleItems = navItems.filter((item) => {
    if (!item.requiredRoles) return true
    return item.requiredRoles.includes(user.role)
  })

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0D0D12] border-r border-[#1E1E2A] flex flex-col z-30">
      {/* Logo */}
      <div className="p-6 border-b border-[#1E1E2A]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#25D366] flex items-center justify-center shrink-0">
            <span className="text-black font-bold text-base">F</span>
          </div>
          <div>
            <p className="text-[#F1F1F3] font-bold text-sm leading-none">Funil Perseguição</p>
            <p className="text-[#5A5A72] text-xs mt-0.5">Gestão de Webhooks</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-[rgba(37,211,102,0.10)] text-[#25D366] border-l-2 border-[#25D366] pl-[10px]"
                  : "text-[#8B8B9E] hover:bg-[#16161E] hover:text-[#F1F1F3]"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 border-t border-[#1E1E2A]" />

      {/* Profile Link */}
      <div className="p-4 space-y-1">
        <Link
          href="/admin/perfil"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            pathname === "/admin/perfil"
              ? "bg-[rgba(37,211,102,0.10)] text-[#25D366] border-l-2 border-[#25D366] pl-[10px]"
              : "text-[#8B8B9E] hover:bg-[#16161E] hover:text-[#F1F1F3]"
          )}
        >
          <User className="w-5 h-5" />
          Meu Perfil
        </Link>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#8B8B9E] hover:bg-[#16161E] hover:text-[#F87171] transition-all w-full text-left"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>

      {/* User info */}
      <div className="p-4 border-t border-[#1E1E2A]">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarImage src={user.avatar_url || ""} alt={user.nome} />
            <AvatarFallback className="text-xs">{getInitials(user.nome)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[#F1F1F3] text-sm font-medium truncate">{user.nome}</p>
            <Badge variant={user.role as "super_admin" | "admin" | "operador" | "viewer" | "cliente"} className="text-[10px] px-1.5 py-0 mt-0.5">
              {roleLabels[user.role as Role]}
            </Badge>
          </div>
        </div>
      </div>
    </aside>
  )
}
