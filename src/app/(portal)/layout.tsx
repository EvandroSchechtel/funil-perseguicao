"use client"

import React, { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"
import { LayoutDashboard, MessageSquare, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

const navItems = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/portal/demandas", label: "Minhas Demandas", icon: MessageSquare, exact: false },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    // Usuários admin não acessam o portal — redireciona para /admin
    if (user.role !== "cliente") {
      router.push("/admin")
      return
    }
  }, [user, loading, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user || user.role !== "cliente") return null

  return (
    <div className="min-h-screen bg-[#0B0B0F] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#16161E] border-r border-[#1E1E2A] flex flex-col fixed inset-y-0 left-0 z-30">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-[#1E1E2A]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#25D366]/15 flex items-center justify-center">
              <span className="text-[#25D366] font-bold text-sm">F</span>
            </div>
            <span className="text-[#F1F1F3] font-semibold text-sm">Portal do Cliente</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#25D366]/10 text-[#25D366]"
                    : "text-[#8B8B9E] hover:text-[#F1F1F3] hover:bg-[#1C1C28]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-[#1E1E2A]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1C1C28] transition-colors text-left">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className="text-xs bg-[#1E1E2A] text-[#25D366]">
                    {getInitials(user.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm text-[#F1F1F3] font-medium truncate">{user.nome.split(" ")[0]}</p>
                  <p className="text-xs text-[#5A5A72] truncate">Cliente</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
              <DropdownMenuLabel>
                <p className="text-[#F1F1F3] font-medium text-sm">{user.nome}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 min-h-screen flex flex-col">
        {children}
      </main>
    </div>
  )
}
