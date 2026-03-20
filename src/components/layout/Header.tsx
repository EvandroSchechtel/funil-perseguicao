"use client"

import React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { Role } from "@/lib/auth/rbac"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
}

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

export function Header({ breadcrumbs = [], actions }: HeaderProps) {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <header className="h-16 bg-[#0B0B0F] border-b border-[#1E1E2A] flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5">
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-[#5A5A72]" />
            )}
            {item.href ? (
              <Link
                href={item.href}
                className="text-sm text-[#8B8B9E] hover:text-[#F1F1F3] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-sm text-[#F1F1F3] font-medium">{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {actions}

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#1C1C28] transition-colors">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.avatar_url || ""} alt={user.nome} />
                <AvatarFallback className="text-xs">{getInitials(user.nome)}</AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm text-[#F1F1F3] font-medium leading-none">{user.nome.split(" ")[0]}</p>
                <Badge variant={user.role as "super_admin" | "admin" | "operador" | "viewer" | "cliente"} className="text-[10px] px-1.5 py-0 mt-1">
                  {roleLabels[user.role as Role]}
                </Badge>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div>
                <p className="text-[#F1F1F3] font-medium text-sm">{user.nome}</p>
                <p className="text-[#5A5A72] text-xs truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/perfil">Meu Perfil</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={logout}>
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
