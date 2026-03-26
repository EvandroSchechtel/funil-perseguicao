"use client"

import { Smartphone, Loader2, Save, ScanSearch, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type CampanhaData, type InstanciaOption, type VarreduraResult, fmtDt } from "./types"

interface InstanciaZApiSectionProps {
  campanha: CampanhaData
  accessToken: string | null
  canWrite: boolean
  instancias: InstanciaOption[]
  instanciaId: string | null
  onInstanciaChange: (id: string | null) => void
  onSaveInstancia: () => void
  savingInstancia: boolean
  varrendo: boolean
  varreduraResult: VarreduraResult | null
  onVarredura: () => void
}

export function InstanciaZApiSection({
  campanha,
  accessToken,
  canWrite,
  instancias,
  instanciaId,
  onInstanciaChange,
  onSaveInstancia,
  savingInstancia,
  varrendo,
  varreduraResult,
  onVarredura,
}: InstanciaZApiSectionProps) {
  return (
    <section className="space-y-3">
      <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5" />
        Instância Z-API
      </p>
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
        {!campanha?.cliente ? (
          <p className="text-[#5A5A72] text-sm">Vincule um cliente à campanha para selecionar uma instância Z-API.</p>
        ) : instancias.length === 0 ? (
          <p className="text-[#5A5A72] text-sm">Nenhuma instância Z-API encontrada para o cliente <span className="text-[#C4C4D4]">{campanha.cliente.nome}</span>.</p>
        ) : (
          <div className="flex items-center gap-3">
            <select
              value={instanciaId ?? ""}
              onChange={(e) => onInstanciaChange(e.target.value || null)}
              className="flex-1 bg-[#0F0F1A] border border-[#2E2E3E] text-[#EEEEF5] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#25D366]"
            >
              <option value="">— Nenhuma instância —</option>
              {instancias.map((inst) => (
                <option key={inst.id} value={inst.id} disabled={inst.status !== "ativo"}>
                  {inst.nome}{inst.status !== "ativo" ? " (inativa)" : ""}
                </option>
              ))}
            </select>
            {canWrite && (
              <Button
                size="sm"
                onClick={onSaveInstancia}
                disabled={savingInstancia || instanciaId === (campanha?.instancia_zapi?.id ?? null)}
              >
                {savingInstancia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span className="ml-1">Salvar</span>
              </Button>
            )}
          </div>
        )}
        {campanha?.instancia_zapi && (
          <p className="text-xs text-[#5A5A72] mt-2">
            Vinculada: <span className="text-[#25D366]">{campanha.instancia_zapi.nome}</span>
            {campanha.instancia_zapi.status !== "ativo" && <span className="text-[#F87171] ml-1">(inativa)</span>}
          </p>
        )}

        {/* Varredura de grupos */}
        {campanha?.instancia_zapi && canWrite && (
          <div className="mt-4 pt-4 border-t border-[#1E1E2A]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#C4C4D4]">Verificar Membros</p>
                <p className="text-xs text-[#5A5A72] mt-0.5">
                  {campanha.ultima_varredura_at
                    ? `Última: ${fmtDt(campanha.ultima_varredura_at)}`
                    : "Verifica quem já está nos grupos e aplica tags"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={onVarredura} loading={varrendo} disabled={varrendo}>
                <ScanSearch className="w-3.5 h-3.5 mr-1.5" />
                {varrendo ? "Verificando…" : "Verificar Membros"}
              </Button>
            </div>
            {varreduraResult && (
              <div className="mt-3 p-3 bg-[#0A1A12] border border-[#25D366]/30 rounded-lg text-xs">
                <p className="text-[#25D366] font-semibold mb-2">Verificação concluída</p>
                {varreduraResult.aviso_24h && (
                  <div className="mb-2 flex items-start gap-1.5 text-[#F59E0B]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <p>{varreduraResult.aviso_24h}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[#8B8B9E]">
                  <span>Grupos varridos: <strong className="text-[#EEEEF5]">{varreduraResult.grupos_varridos}</strong></span>
                  <span>Membros lidos: <strong className="text-[#EEEEF5]">{varreduraResult.total_membros}</strong></span>
                  <span>Leads encontrados: <strong className="text-[#EEEEF5]">{varreduraResult.leads_encontrados}</strong></span>
                  <span>Tags aplicadas: <strong className="text-[#25D366]">{varreduraResult.tags_aplicadas}</strong></span>
                  <span>Já processados: <strong className="text-[#5A5A72]">{varreduraResult.ja_processados}</strong></span>
                  {varreduraResult.grupos_sem_id > 0 && (
                    <span>Grupos sem ID WA: <strong className="text-[#F59E0B]">{varreduraResult.grupos_sem_id}</strong></span>
                  )}
                  {varreduraResult.erros > 0 && (
                    <span>Erros: <strong className="text-[#F87171]">{varreduraResult.erros}</strong></span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
