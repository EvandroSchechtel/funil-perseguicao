"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { RefreshCw, Users, Tag, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type ZApiGrupo, type EntradaItem, formatDate } from "./types"
import { toast } from "sonner"

interface EntradasTableProps {
  instanciaId: string
  grupos: ZApiGrupo[]
  accessToken: string | null
  initialGrupoFilter?: string | null
}

export function EntradasTable({ instanciaId, grupos, accessToken, initialGrupoFilter }: EntradasTableProps) {
  const [entradas, setEntradas] = useState<EntradaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [grupoFiltro, setGrupoFiltro] = useState(initialGrupoFilter || "")

  // Sync initialGrupoFilter when it changes from parent
  useEffect(() => {
    if (initialGrupoFilter !== undefined && initialGrupoFilter !== null) {
      setGrupoFiltro(initialGrupoFilter)
      setLoaded(false) // Force re-fetch
    }
  }, [initialGrupoFilter])

  const fetchEntradas = useCallback(async () => {
    if (!accessToken || !instanciaId) return
    setLoading(true)
    try {
      const params = grupoFiltro ? `?grupo_id=${grupoFiltro}` : ""
      const res = await fetch(`/api/admin/zapi/instancias/${instanciaId}/entradas${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setEntradas(data.entradas || [])
      setLoaded(true)
    } catch {
      toast.error("Erro ao carregar entradas.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, instanciaId, grupoFiltro])

  // Reset loaded state when filter changes
  useEffect(() => { setLoaded(false) }, [grupoFiltro])

  // Fetch on mount or when loaded is reset
  useEffect(() => {
    if (!loaded) fetchEntradas()
  }, [loaded, fetchEntradas])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        {grupos.length > 0 && (
          <select
            value={grupoFiltro}
            onChange={(e) => setGrupoFiltro(e.target.value)}
            className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-lg px-3 py-2 text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/40 transition-all hover:border-[#252535]"
          >
            <option value="">Todos os grupos</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nome_filtro}</option>
            ))}
          </select>
        )}
        <Button size="sm" variant="outline" onClick={fetchEntradas} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Table */}
      <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.35)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#13131F] flex items-center justify-center">
              <Users className="w-5 h-5 text-[#3F3F58]" />
            </div>
            <p className="text-[#7F7F9E] text-sm">Nenhuma entrada registrada</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1C1C2C]">
                {["Participante", "Grupo / Tag", "Lead", "Tag aplicada", "Entrou em"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-[#3F3F58] uppercase tracking-wider px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entradas.map((e) => (
                <tr key={e.id} className="border-b border-[#1C1C2C] last:border-0 hover:bg-[#121220] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-[#EEEEF5] text-sm font-medium">{e.nome_whatsapp || "—"}</p>
                    <p className="text-[#3F3F58] text-xs font-mono mt-0.5">{e.telefone}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-[#9898B0] text-sm">{e.grupo.nome_filtro}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Tag className="w-2.5 h-2.5 text-[#A78BFA]" />
                      <p className="text-[#3F3F58] text-xs">{e.grupo.tag_manychat_nome}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {e.lead ? (
                      <Link href={`/admin/leads/${e.lead.id}`} className="text-[#25D366] text-sm hover:underline font-medium">
                        {e.lead.nome}
                      </Link>
                    ) : (
                      <span className="text-[#3F3F58] text-sm">Não identificado</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {e.tag_aplicada ? (
                      <span className="inline-flex items-center gap-1 text-[#22C55E] text-sm font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Sim
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#3F3F58] text-sm">
                        <XCircle className="w-3.5 h-3.5" />
                        Não
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[#7F7F9E] text-sm whitespace-nowrap">
                    {formatDate(e.entrou_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
