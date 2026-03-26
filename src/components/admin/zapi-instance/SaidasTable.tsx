"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { RefreshCw, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type ZApiGrupo, type SaidaItem, formatDate } from "./types"
import { toast } from "sonner"

interface SaidasTableProps {
  instanciaId: string
  grupos: ZApiGrupo[]
  accessToken: string | null
}

export function SaidasTable({ instanciaId, grupos, accessToken }: SaidasTableProps) {
  const [saidas, setSaidas] = useState<SaidaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [grupoFiltro, setGrupoFiltro] = useState("")

  const fetchSaidas = useCallback(async () => {
    if (!accessToken || !instanciaId) return
    setLoading(true)
    try {
      const params = grupoFiltro ? `?grupo_id=${grupoFiltro}` : ""
      const res = await fetch(`/api/admin/zapi/instancias/${instanciaId}/saidas${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setSaidas(data.saidas || [])
      setLoaded(true)
    } catch {
      toast.error("Erro ao carregar saídas.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, instanciaId, grupoFiltro])

  // Reset loaded state when filter changes
  useEffect(() => { setLoaded(false) }, [grupoFiltro])

  // Fetch on mount or when loaded is reset
  useEffect(() => {
    if (!loaded) fetchSaidas()
  }, [loaded, fetchSaidas])

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
        <Button size="sm" variant="outline" onClick={fetchSaidas} disabled={loading}>
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
        ) : saidas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#13131F] flex items-center justify-center">
              <XCircle className="w-5 h-5 text-[#3F3F58]" />
            </div>
            <p className="text-[#7F7F9E] text-sm">Nenhuma saída registrada</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1C1C2C]">
                {["Participante", "Grupo", "Lead", "Saiu em"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-[#3F3F58] uppercase tracking-wider px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {saidas.map((s) => (
                <tr key={s.id} className="border-b border-[#1C1C2C] last:border-0 hover:bg-[#121220] transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-[#EEEEF5] text-sm font-medium">{s.nome_whatsapp || "—"}</p>
                    <p className="text-[#3F3F58] text-xs font-mono mt-0.5">{s.telefone}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-[#9898B0] text-sm">{s.grupo.nome_filtro}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    {s.lead ? (
                      <Link href={`/admin/leads/${s.lead.id}`} className="text-[#25D366] text-sm hover:underline font-medium">
                        {s.lead.nome}
                      </Link>
                    ) : (
                      <span className="text-[#3F3F58] text-sm">Não identificado</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[#7F7F9E] text-sm whitespace-nowrap">
                    {formatDate(s.saiu_at)}
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
