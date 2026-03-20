"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, Search, Megaphone, MoreHorizontal, Users2, Webhook, Building2, ChevronRight, PauseCircle, PlayCircle, Loader2 } from "lucide-react"
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
  pausado_at: string | null
  data_inicio: string | null
  data_fim: string | null
  webhooks_count: number
  leads_count: number
  created_at: string
  usuario: { nome: string }
  cliente: { id: string; nome: string } | null
}

function groupByCliente(list: CampanhaItem[]) {
  const map = new Map<string, { label: string; items: CampanhaItem[] }>()
  for (const c of list) {
    const key = c.cliente?.id ?? "__none"
    const label = c.cliente?.nome ?? "Sem cliente vinculado"
    if (!map.has(key)) map.set(key, { label, items: [] })
    map.get(key)!.items.push(c)
  }
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (a === "__none") return 1
    if (b === "__none") return -1
    return 0
  })
}

export default function CampanhasPage() {
  const { accessToken, user } = useAuth()
  const router = useRouter()
  const [campanhas, setCampanhas] = useState<CampanhaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [clienteFilter, setClienteFilter] = useState("all")
  const [deleteDialog, setDeleteDialog] = useState<CampanhaItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canWrite = user ? hasPermission(user.role, "campanhas:write") : false
  const canDelete = user ? hasPermission(user.role, "campanhas:write") : false

  const fetchCampanhas = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: "100", ...(search && { q: search }) })
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

  async function handleToggle(campanha: CampanhaItem, e: React.MouseEvent) {
    e.stopPropagation()
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

  async function handlePauseToggle(campanha: CampanhaItem, e: React.MouseEvent) {
    e.stopPropagation()
    const action = campanha.pausado_at ? "retomar" : "pausar"
    setActionLoading(campanha.id + "-pause")
    try {
      const res = await fetch(`/api/admin/campanhas/${campanha.id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchCampanhas()
      } else {
        toast.error(data.message || "Erro ao alterar estado de pausa.")
      }
    } catch {
      toast.error("Erro ao alterar estado de pausa.")
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
    return new Date(str).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const filtered = clienteFilter === "all"
    ? campanhas
    : campanhas.filter((c) => (c.cliente?.id ?? "__none") === clienteFilter)

  const grouped = groupByCliente(filtered)

  const clientes = Array.from(
    new Map(campanhas.filter((c) => c.cliente).map((c) => [c.cliente!.id, c.cliente!.nome])).entries()
  )

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Campanhas" }]} />

      <div className="p-6">
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

        {/* Search + Client filter */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          {!loading && clientes.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {[{ id: "all", nome: "Todos os clientes" }, ...clientes.map(([id, nome]) => ({ id, nome }))].map(({ id, nome }) => (
                <button
                  key={id}
                  onClick={() => setClienteFilter(id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    clienteFilter === id
                      ? "bg-[#25D366]/12 text-[#25D366] border-[#25D366]/25"
                      : "text-[#8B8B9E] border-[#1E1E2A] hover:border-[#2A2A3A] hover:text-[#F1F1F3]"
                  }`}
                >
                  {nome}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : campanhas.length === 0 ? (
          <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1E1E2A] flex items-center justify-center">
              <Megaphone className="w-8 h-8 text-[#25D366]" />
            </div>
            <div className="text-center">
              <p className="text-[#F1F1F3] font-semibold text-lg">
                {search ? "Nenhuma campanha encontrada" : "Nenhuma campanha criada"}
              </p>
              <p className="text-[#8B8B9E] text-sm mt-1">
                {search ? "Tente ajustar os filtros de busca" : "Crie uma campanha para organizar seus webhooks e leads"}
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
          <div className="space-y-7">
            {grouped.map(([key, { label, items }]) => (
              <div key={key}>
                {/* Client section header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <Building2 className="w-4 h-4 text-[#25D366] shrink-0" />
                  <span className="text-[#EEEEF5] text-sm font-semibold">{label}</span>
                  <span className="text-[#3F3F58] text-xs">
                    {items.length} campanha{items.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-[#1E1E2A]" />
                  {key !== "__none" && (
                    <Link
                      href={`/admin/clientes/${key}`}
                      className="text-xs text-[#5A5A72] hover:text-[#25D366] transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Ver cliente →
                    </Link>
                  )}
                </div>

                <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
                  {items.map((c, idx) => (
                    <div
                      key={c.id}
                      onClick={() => router.push(`/admin/campanhas/${c.id}`)}
                      className={`flex items-center gap-4 px-5 py-4 hover:bg-[#1C1C28] transition-colors cursor-pointer ${idx !== items.length - 1 ? "border-b border-[#1E1E2A]" : ""}`}
                    >
                      {/* Status indicator */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${c.pausado_at ? "bg-[#F59E0B]" : c.status === "ativo" ? "bg-[#25D366]" : "bg-[#3F3F58]"}`} />

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[#F1F1F3] font-medium text-sm">{c.nome}</p>
                        {c.descricao && (
                          <p className="text-[#5A5A72] text-xs mt-0.5 truncate max-w-sm">{c.descricao}</p>
                        )}
                      </div>

                      {/* Status badge */}
                      {c.pausado_at ? (
                        <Badge variant="inativo" className="shrink-0 border-[#F59E0B]/40 bg-[#1A1500] text-[#F59E0B]">
                          Pausada
                        </Badge>
                      ) : (
                        <Badge variant={c.status === "ativo" ? "ativo" : "inativo"} className="shrink-0">
                          {c.status === "ativo" ? "Ativa" : "Inativa"}
                        </Badge>
                      )}

                      {/* Período */}
                      <div className="hidden md:block shrink-0 text-right">
                        <p className="text-[#8B8B9E] text-xs">
                          {c.data_inicio || c.data_fim
                            ? `${formatDate(c.data_inicio)} → ${formatDate(c.data_fim)}`
                            : "Sem período"}
                        </p>
                      </div>

                      {/* Counters */}
                      <div className="hidden lg:flex items-center gap-4 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Webhook className="w-3.5 h-3.5 text-[#5A5A72]" />
                          <span className="text-[#C4C4D4] text-sm">{c.webhooks_count}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users2 className="w-3.5 h-3.5 text-[#5A5A72]" />
                          <span className="text-[#C4C4D4] text-sm">{c.leads_count}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Pause/resume toggle — direct button on the row */}
                        {canWrite && (
                          <button
                            onClick={(e) => handlePauseToggle(c, e)}
                            disabled={actionLoading === c.id + "-pause"}
                            title={c.pausado_at ? "Retomar campanha" : "Pausar campanha"}
                            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[#1E1E2A] transition-colors text-[#5A5A72] hover:text-[#F59E0B] disabled:opacity-40"
                          >
                            {actionLoading === c.id + "-pause" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : c.pausado_at ? (
                              <PlayCircle className="w-4 h-4 text-[#F59E0B]" />
                            ) : (
                              <PauseCircle className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/admin/campanhas/${c.id}`)}>
                              Ver detalhes
                            </DropdownMenuItem>
                            {canWrite && (
                              <DropdownMenuItem onClick={() => router.push(`/admin/campanhas/${c.id}/editar`)}>
                                Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => handleToggle(c, e as unknown as React.MouseEvent)}
                              disabled={actionLoading === c.id + "-toggle"}
                            >
                              {c.status === "ativo" ? "Desativar" : "Ativar"}
                            </DropdownMenuItem>
                            {canWrite && (
                              <DropdownMenuItem
                                onClick={(e) => handlePauseToggle(c, e as unknown as React.MouseEvent)}
                                disabled={actionLoading === c.id + "-pause"}
                              >
                                {c.pausado_at ? (
                                  <><PlayCircle className="w-4 h-4 mr-2 text-[#25D366]" />Retomar</>
                                ) : (
                                  <><PauseCircle className="w-4 h-4 mr-2 text-[#F59E0B]" />Pausar</>
                                )}
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem destructive onClick={() => setDeleteDialog(c)}>
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronRight className="w-4 h-4 text-[#3F3F58]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
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
