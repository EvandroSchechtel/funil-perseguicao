"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Megaphone, MoreHorizontal, Users2, Webhook, Building2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

interface CampanhaItem {
  id: string
  nome: string
  descricao: string | null
  status: "ativo" | "inativo"
  data_inicio: string | null
  data_fim: string | null
  webhooks_count: number
  leads_count: number
  created_at: string
  usuario: { nome: string }
  cliente: { id: string; nome: string } | null
}

export default function CampanhasPage() {
  const { accessToken, user } = useAuth()
  const [campanhas, setCampanhas] = useState<CampanhaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<CampanhaItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canWrite = user ? hasPermission(user.role, "campanhas:write") : false
  const canDelete = user ? hasPermission(user.role, "campanhas:write") : false

  const fetchCampanhas = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: "50", ...(search && { q: search }) })
      const res = await fetch(`/api/admin/campanhas?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCampanhas(data.data || [])
    } catch {
      toast.error("Erro ao carregar campanhas.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, search])

  useEffect(() => {
    const timer = setTimeout(fetchCampanhas, search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [fetchCampanhas, search])

  async function handleToggle(campanha: CampanhaItem) {
    setActionLoading(campanha.id + "-toggle")
    try {
      const res = await fetch(`/api/admin/campanhas/${campanha.id}/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchCampanhas()
      } else {
        toast.error(data.message || "Erro ao alterar status.")
      }
    } catch {
      toast.error("Erro ao alterar status.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(campanha: CampanhaItem) {
    setActionLoading(campanha.id + "-delete")
    try {
      const res = await fetch(`/api/admin/campanhas/${campanha.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setDeleteDialog(null)
        fetchCampanhas()
      } else {
        toast.error(data.message || "Erro ao excluir campanha.")
      }
    } catch {
      toast.error("Erro ao excluir campanha.")
    } finally {
      setActionLoading(null)
    }
  }

  function formatDate(str: string | null) {
    if (!str) return "—"
    return new Date(str).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    })
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Campanhas" },
        ]}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Campanhas</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">Lançamentos e campanhas de marketing</p>
          </div>
          {canWrite && (
            <Link href="/admin/campanhas/nova">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Campanha
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="mb-5">
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {/* Table */}
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
            </div>
          ) : campanhas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1E1E2A] flex items-center justify-center">
                <Megaphone className="w-8 h-8 text-[#25D366]" />
              </div>
              <div className="text-center">
                <p className="text-[#F1F1F3] font-semibold text-lg">
                  {search ? "Nenhuma campanha encontrada" : "Nenhuma campanha criada"}
                </p>
                <p className="text-[#8B8B9E] text-sm mt-1">
                  {search
                    ? "Tente ajustar os filtros de busca"
                    : "Crie uma campanha para organizar seus webhooks e leads"}
                </p>
              </div>
              {!search && canWrite && (
                <Link href="/admin/campanhas/nova">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Campanha
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E1E2A]">
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Nome</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Período</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Webhooks</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Leads</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c) => (
                  <tr key={c.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-[#F1F1F3] font-medium text-sm">{c.nome}</p>
                      {c.descricao && (
                        <p className="text-[#5A5A72] text-xs mt-0.5 truncate max-w-xs">{c.descricao}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {c.cliente ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#5A5A72]" />
                          <span className="text-[#C4C4D4] text-sm">{c.cliente.nome}</span>
                        </div>
                      ) : (
                        <span className="text-[#5A5A72] text-sm">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={c.status === "ativo" ? "ativo" : "inativo"}>
                        {c.status === "ativo" ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[#8B8B9E] text-sm">
                        {c.data_inicio || c.data_fim
                          ? `${formatDate(c.data_inicio)} → ${formatDate(c.data_fim)}`
                          : "—"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Webhook className="w-3.5 h-3.5 text-[#5A5A72]" />
                        <span className="text-[#C4C4D4] text-sm">{c.webhooks_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Users2 className="w-3.5 h-3.5 text-[#5A5A72]" />
                        <span className="text-[#C4C4D4] text-sm">{c.leads_count}</span>
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
                              <Link href={`/admin/campanhas/${c.id}/editar`}>Editar</Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleToggle(c)}
                            disabled={actionLoading === c.id + "-toggle"}
                          >
                            {c.status === "ativo" ? "Desativar" : "Ativar"}
                          </DropdownMenuItem>
                          {canDelete && (
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

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Campanha</DialogTitle>
          </DialogHeader>
          <p className="text-[#8B8B9E] text-sm">
            Tem certeza que deseja excluir a campanha{" "}
            <span className="text-[#F1F1F3] font-semibold">{deleteDialog?.nome}</span>?
            Esta ação não pode ser desfeita. Campanhas com webhooks ativos não podem ser excluídas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && handleDelete(deleteDialog)}
              loading={actionLoading === deleteDialog?.id + "-delete"}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
