"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Building2, MoreHorizontal, Megaphone, Zap } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

interface ClienteItem {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  contas_count: number
  campanhas_count: number
  created_at: string
}

export default function ClientesPage() {
  const { accessToken, user } = useAuth()
  const [clientes, setClientes] = useState<ClienteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<ClienteItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canWrite = user ? hasPermission(user.role, "clientes:write") : false

  const fetchClientes = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: "100", ...(search && { q: search }) })
      const res = await fetch(`/api/admin/clientes?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setClientes(data.data || [])
    } catch {
      toast.error("Erro ao carregar clientes.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, search])

  useEffect(() => {
    const timer = setTimeout(fetchClientes, search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [fetchClientes, search])

  async function handleDelete(cliente: ClienteItem) {
    setActionLoading(cliente.id)
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setDeleteDialog(null)
        fetchClientes()
      } else {
        toast.error(data.message || "Erro ao excluir cliente.")
      }
    } catch {
      toast.error("Erro ao excluir cliente.")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Clientes" },
        ]}
      />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Clientes</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">Empresas e pessoas com contas Manychat</p>
          </div>
          {canWrite && (
            <Link href="/admin/clientes/novo">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </Link>
          )}
        </div>

        <div className="mb-5">
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
            </div>
          ) : clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1E1E2A] flex items-center justify-center">
                <Building2 className="w-8 h-8 text-[#25D366]" />
              </div>
              <div className="text-center">
                <p className="text-[#F1F1F3] font-semibold text-lg">
                  {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                </p>
                <p className="text-[#8B8B9E] text-sm mt-1">
                  {search ? "Tente ajustar a busca" : "Crie o primeiro cliente para começar"}
                </p>
              </div>
              {!search && canWrite && (
                <Link href="/admin/clientes/novo">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Cliente
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E1E2A]">
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Contato</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Contas MC</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Campanhas</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#1E1E2A] flex items-center justify-center shrink-0">
                          <span className="text-[#25D366] font-bold text-sm">
                            {c.nome.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[#F1F1F3] font-medium text-sm">{c.nome}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[#C4C4D4] text-sm">{c.email || "—"}</p>
                      {c.telefone && (
                        <p className="text-[#5A5A72] text-xs mt-0.5">{c.telefone}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#5A5A72]" />
                        <span className="text-[#C4C4D4] text-sm">{c.contas_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Megaphone className="w-3.5 h-3.5 text-[#5A5A72]" />
                        <span className="text-[#C4C4D4] text-sm">{c.campanhas_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canWrite && (
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/clientes/${c.id}/editar`}>Editar</Link>
                            </DropdownMenuItem>
                          )}
                          {canWrite && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onClick={() => setDeleteDialog(c)}
                              >
                                Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Cliente</DialogTitle>
          </DialogHeader>
          <p className="text-[#8B8B9E] text-sm">
            Tem certeza que deseja excluir{" "}
            <span className="text-[#F1F1F3] font-semibold">{deleteDialog?.nome}</span>?
            Clientes com campanhas vinculadas não podem ser excluídos.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
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
