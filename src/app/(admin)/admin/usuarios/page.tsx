"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  RotateCcw,
  User,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import type { Role } from "@/lib/auth/rbac"
import { getRoleLabel } from "@/lib/auth/rbac"

interface UsuarioListItem {
  id: string
  nome: string
  email: string
  role: Role
  avatar_url: string | null
  status: "ativo" | "inativo"
  ultimo_login: string | null
  created_at: string
}

function getInitials(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Nunca"
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return "agora há pouco"
  if (diff < 3600) return `há ${Math.floor(diff / 60)} minutos`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} horas`
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} dias`
  return date.toLocaleDateString("pt-BR")
}

export default function UsuariosPage() {
  const { user, accessToken } = useAuth()
  const router = useRouter()

  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [deleteDialog, setDeleteDialog] = useState<UsuarioListItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const perPage = 20

  const fetchUsuarios = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        ...(search && { q: search }),
        ...(roleFilter && roleFilter !== "all" && { role: roleFilter }),
      })

      const res = await fetch(`/api/admin/usuarios?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!res.ok) throw new Error("Erro ao carregar usuários")

      const data = await res.json()
      setUsuarios(data.data)
      setTotalPages(data.meta.total_pages)
      setTotal(data.meta.total)
    } catch {
      toast.error("Erro ao carregar usuários")
    } finally {
      setLoading(false)
    }
  }, [accessToken, page, search, roleFilter])

  useEffect(() => {
    // Redirect if not super_admin
    if (user && user.role !== "super_admin") {
      router.push("/admin/manychat")
      return
    }
    fetchUsuarios()
  }, [user, fetchUsuarios, router])

  // Debounce search
  useEffect(() => {
    setPage(1)
  }, [search, roleFilter])

  async function handleToggle(u: UsuarioListItem) {
    setActionLoading(u.id)
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || "Erro ao alterar status")
        return
      }
      toast.success(`Usuário ${data.data.status === "ativo" ? "ativado" : "desativado"} com sucesso`)
      fetchUsuarios()
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(u: UsuarioListItem) {
    setActionLoading(u.id)
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || "Erro ao excluir")
        return
      }
      toast.success("Usuário excluído com sucesso")
      setDeleteDialog(null)
      fetchUsuarios()
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleResetSenha(u: UsuarioListItem) {
    setActionLoading(u.id)
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}/reset-senha`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || "Erro ao resetar senha")
        return
      }
      toast.success("Senha resetada. Email enviado ao usuário.")
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setActionLoading(null)
    }
  }

  const isSelf = (u: UsuarioListItem) => u.id === user?.id

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Usuários" },
        ]}
      />

      <div className="p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#F1F1F3]">Usuários</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">
              Gerencie os usuários com acesso ao sistema.
            </p>
          </div>
          <Link href="/admin/usuarios/novo">
            <Button>
              <Plus className="w-4 h-4" />
              Novo Usuário
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Buscar por nome ou email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todos os perfis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os perfis</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="operador">Operador</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#111118] flex items-center justify-center mb-4">
                <User className="w-7 h-7 text-[#5A5A72]" />
              </div>
              <h3 className="text-[#F1F1F3] font-semibold mb-1">Nenhum usuário encontrado</h3>
              <p className="text-[#8B8B9E] text-sm">
                {search || roleFilter ? "Tente ajustar os filtros" : "Crie o primeiro usuário"}
              </p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#111118]">
                    <th className="text-left px-4 py-3 text-[#8B8B9E] text-xs font-semibold uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="text-left px-4 py-3 text-[#8B8B9E] text-xs font-semibold uppercase tracking-wider">
                      Perfil
                    </th>
                    <th className="text-left px-4 py-3 text-[#8B8B9E] text-xs font-semibold uppercase tracking-wider">
                      Último Login
                    </th>
                    <th className="text-left px-4 py-3 text-[#8B8B9E] text-xs font-semibold uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E1E2A]">
                  {usuarios.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-[#1C1C28] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={u.avatar_url || ""} alt={u.nome} />
                            <AvatarFallback className="text-xs">
                              {getInitials(u.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <Link href={`/admin/usuarios/${u.id}/editar`} className="text-[#F1F1F3] text-sm font-semibold hover:text-[#25D366] transition-colors">
                              {u.nome}
                              {isSelf(u) && (
                                <span className="ml-2 text-[#25D366] text-xs font-normal">(você)</span>
                              )}
                            </Link>
                            <p className="text-[#8B8B9E] text-xs">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role as "super_admin" | "admin" | "operador" | "viewer" | "cliente"}>{getRoleLabel(u.role as import("@/lib/auth/rbac").Role)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[#8B8B9E] text-sm">
                        {formatRelativeTime(u.ultimo_login)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.status}>{u.status === "ativo" ? "Ativo" : "Inativo"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B8B9E] hover:text-[#F1F1F3] hover:bg-[#1C1C28] transition-colors"
                              disabled={actionLoading === u.id}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/admin/usuarios/${u.id}/editar`)}
                            >
                              <Pencil className="w-4 h-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetSenha(u)}>
                              <RotateCcw className="w-4 h-4" />
                              Resetar senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggle(u)}
                              disabled={isSelf(u)}
                            >
                              <Power className="w-4 h-4" />
                              {u.status === "ativo" ? "Desativar" : "Ativar"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              destructive
                              onClick={() => setDeleteDialog(u)}
                              disabled={isSelf(u)}
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-[#1E1E2A] flex items-center justify-between">
                  <p className="text-[#8B8B9E] text-sm">
                    Mostrando {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} de{" "}
                    {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                    >
                      ← Anterior
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
                      Próximo →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong className="text-[#F1F1F3]">{deleteDialog?.nome}</strong>? Esta ação não pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && handleDelete(deleteDialog)}
              loading={actionLoading === deleteDialog?.id}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
