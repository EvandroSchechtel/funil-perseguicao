"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Webhook, Zap, Shield, User, LogOut, Bot, Megaphone, Building2, Contact, Activity, MessageSquare, FileText, Rocket } from "lucide-react"
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

// Operacional — visível para operadores
const navItemsOperacional: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: <LayoutDashboard className="w-5 h-5" />,
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
    label: "Webhooks",
    href: "/admin/webhooks",
    icon: <Webhook className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
  {
    label: "Demandas",
    href: "/admin/demandas",
    icon: <FileText className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
  {
    label: "Contatos",
    href: "/admin/contatos",
    icon: <Contact className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
]

// Infra/Config — admin e super_admin
const navItemsInfra: NavItem[] = [
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
    label: "Agente IA",
    href: "/admin/agente",
    icon: <Bot className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin", "operador"],
  },
  {
    label: "Implantação",
    href: "/admin/implantacao",
    icon: <Rocket className="w-5 h-5" />,
    requiredRoles: ["super_admin", "admin"],
  },
  {
    label: "Usuários",
    href: "/admin/usuarios",
    icon: <Shield className="w-5 h-5" />,
    requiredRoles: ["super_admin"],
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
  const { user, logout, accessToken } = useAuth()
  const pathname = usePathname()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    const check = () => {
      fetch("/api/admin/alertas", { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json())
        .then((json) => {
          if (!cancelled) setAlertCount(json?.data?.ativos?.length ?? 0)
        })
        .catch(() => {})
    }
    check()
    const id = setInterval(check, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [accessToken])

  if (!user) return null

  function filterByRole(items: NavItem[]) {
    return items.filter((item) => {
      if (!item.requiredRoles) return true
      return item.requiredRoles.includes(user!.role)
    })
  }

  const operacional = filterByRole(navItemsOperacional)
  const infra = filterByRole(navItemsInfra)

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item.href)
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
          active
            ? "bg-[rgba(37,211,102,0.10)] text-[#25D366] border-l-2 border-[#25D366] pl-[10px]"
            : "text-[#8B8B9E] hover:bg-[#16161E] hover:text-[#F1F1F3]"
        )}
      >
        {item.icon}
        <span className="flex-1">{item.label}</span>
        {item.href === "/admin/fila" && alertCount > 0 && (
          <span className="bg-[#F87171] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none shrink-0">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </Link>
    )
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
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {operacional.map((item) => <NavLink key={item.href} item={item} />)}
        </div>

        {infra.length > 0 && (
          <>
            <div className="border-t border-[#1E1E2A] mx-1 my-3" />
            <div className="space-y-1">
              {infra.map((item) => <NavLink key={item.href} item={item} />)}
            </div>
          </>
        )}
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
