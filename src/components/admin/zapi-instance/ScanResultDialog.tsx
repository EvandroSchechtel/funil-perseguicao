"use client"

import React, { useState } from "react"
import { Search, CheckCircle2, XCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { type EscanearResult } from "./types"

interface ScanResultDialogProps {
  open: boolean
  result: EscanearResult | null
  onClose: () => void
}

export function ScanResultDialog({ open, result, onClose }: ScanResultDialogProps) {
  const [filter, setFilter] = useState("")

  function handleClose() {
    setFilter("")
    onClose()
  }

  if (!result) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resultado do Escaneamento</DialogTitle>
          <DialogDescription>
            {result.total_grupos_zapi} grupos encontrados no Z-API
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-3 text-center">
              <p className="text-[#25D366] text-xl font-bold">{result.novos_vinculados}</p>
              <p className="text-[#3F3F58] text-xs mt-0.5">Novos vinculados</p>
            </div>
            <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-3 text-center">
              <p className="text-[#7F7F9E] text-xl font-bold">{result.ja_configurados}</p>
              <p className="text-[#3F3F58] text-xs mt-0.5">Já configurados</p>
            </div>
            <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-3 text-center">
              <p className="text-[#3F3F58] text-xl font-bold">{result.sem_match}</p>
              <p className="text-[#3F3F58] text-xs mt-0.5">Sem match</p>
            </div>
          </div>

          {/* Entradas processadas */}
          {(result.entradas_processadas ?? 0) > 0 && (
            <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-3 text-center">
              <p className="text-[#60A5FA] text-xl font-bold">{result.entradas_processadas}</p>
              <p className="text-[#3F3F58] text-xs mt-0.5">
                Entradas processadas
                {(result.erros_entradas ?? 0) > 0 && (
                  <span className="text-[#F87171] ml-1">({result.erros_entradas} erros)</span>
                )}
              </p>
            </div>
          )}

          {/* Name filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#3F3F58]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por nome..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#1C1C2C] bg-[#0A0A12] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/40 transition-colors"
            />
          </div>

          {/* Detail list */}
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {result.detalhes
              .filter((d) => !filter || d.nome.toLowerCase().includes(filter.toLowerCase()))
              .map((d, i) => (
                <div
                  key={`${d.grupoWaId || i}-${d.acao}`}
                  className="flex items-start gap-3 bg-[#0A0A12] border border-[#1C1C2C] rounded-lg px-3 py-2.5"
                >
                  <div className="shrink-0 mt-0.5">
                    {d.acao === "criado" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
                    ) : d.acao === "existente" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#7F7F9E]" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-[#3F3F58]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#EEEEF5] text-xs font-medium truncate">{d.nome}</p>
                    {d.templateNomeFiltro && (
                      <p className="text-[#3F3F58] text-[10px] mt-0.5 truncate">
                        Template: {d.templateNomeFiltro}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {d.leads_count > 0 && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#25D366]/10 text-[#25D366]">
                        {d.leads_count} leads
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-[#3F3F58]">
                      {(d.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
