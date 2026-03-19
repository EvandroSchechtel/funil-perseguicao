"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, Users, Download, ExternalLink, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

interface ContatoConta {
  subscriber_id: string | null
  conta: { id: string; nome: string; page_name: string | null }
}

interface Contato {
  id: string
  telefone: string
  nome: string
  email: string | null
  created_at: string
  updated_at: string
  leads_count: number
  contas_count: number
  contas_vinculadas: ContatoConta[]
}

function statusIcon(status: string) {
  if (status === "sucesso") return <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
  if (status === "falha") return <XCircle className="w-3.5 h-3.5 text-[#F87171]" />
  if (status === "sem_optin") return <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
  if (status === "processando") return <Loader2 className="w-3.5 h-3.5 text-[#60A5FA] animate-spin" />
  return <Clock className="w-3.5 h-3.5 text-[#5A5A72]" />
}

export default function ContatosPage() {
  const { accessToken, user } = useAuth()
  const [contatos, setContatos] = useState<Contato[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [exporting, setExporting] = useState(false)

  const canExport = user ? hasPermission(user.role, "dados:export") : false

  const fetchContatos = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), per_page: "20", search })
    fetch(`/api/admin/contatos?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((data) => {
        setContatos(data.data || [])
        setTotalPages(data.pagination?.total_pages || 1)
        setTotal(data.pagination?.total || 0)
      })
      .catch(() => toast.error("Erro ao carregar contatos."))
      .finally(() => setLoading(false))
  }, [accessToken, page, search])

  useEffect(() => { fetchContatos() }, [fetchContatos])

  // debounce search
  useEffect(() => { setPage(1) }, [search])

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ search })
      const res = await fetch(`/api/admin/contatos/export?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) { toast.error("Erro ao exportar."); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Contatos" }]} />

      <div className="p-6 flex flex-col gap-4 flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Contatos</h1>
            <p className="text-[#8B8B9E] text-sm mt-0.5">
              {total > 0 ? `${total} contato${total !== 1 ? "s" : ""} — identificados por telefone` : "Carregando..."}
            </p>
          </div>
          {canExport && (
            <Button variant="outline" size="sm" onClick={handleExport} loading={exporting}>
              <Download className="w-4 h-4 mr-1.5" />
              Exportar CSV
            </Button>
          )}
        </div>

        {/* Search */}
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />

        {/* Table */}
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
            </div>
          ) : contatos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Users className="w-10 h-10 text-[#5A5A72]" />
              <p className="text-[#5A5A72] text-sm">Nenhum contato encontrado</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E1E2A]">
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Contato</th>
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Contas Manychat</th>
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Campanhas</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {contatos.map((c) => (
                    <tr key={c.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-[#F1F1F3] text-sm font-medium">{c.nome}</p>
                        <p className="text-[#8B8B9E] text-xs font-mono mt-0.5">{c.telefone}</p>
                        {c.email && <p className="text-[#5A5A72] text-xs mt-0.5">{c.email}</p>}
                      </td>
                      <td className="px-5 py-4">
                        {c.contas_vinculadas.length === 0 ? (
                          <span className="text-[#5A5A72] text-xs">Nenhuma</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {c.contas_vinculadas.map((cv, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3 text-[#25D366] shrink-0" />
                                <span className="text-xs text-[#C4C4D4]">{cv.conta.nome}</span>
                                {cv.subscriber_id && (
                                  <span className="text-xs font-mono text-[#5A5A72]">#{cv.subscriber_id}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-[#C4C4D4]">
                          {c.leads_count} campanha{c.leads_count !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/admin/contatos/${c.id}`} className="p-1.5 text-[#5A5A72] hover:text-[#25D366] transition-colors inline-flex">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#1E1E2A]">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    Anterior
                  </Button>
                  <span className="text-[#5A5A72] text-xs">Página {page} de {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
