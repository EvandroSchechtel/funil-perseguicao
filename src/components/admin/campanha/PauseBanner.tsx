"use client"

import { PauseCircle, PlayCircle, ChevronsRight, ListOrdered } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type CampanhaData, formatDate } from "./types"

interface PauseBannerProps {
  campanha: CampanhaData
  canWrite: boolean
  pauseLoading: string | null
  onAction: (action: "pausar" | "retomar" | "soltar-um" | "soltar-todos") => void
}

export function PauseBanner({ campanha, canWrite, pauseLoading, onAction }: PauseBannerProps) {
  if (!campanha.pausado_at) return null

  return (
    <div className="bg-[#1A1500] border border-[#F59E0B]/30 rounded-xl px-5 py-4">
      <div className="flex items-center gap-3">
        <PauseCircle className="w-5 h-5 text-[#F59E0B] shrink-0" />
        <div>
          <p className="text-[#F59E0B] font-semibold text-sm">Campanha pausada</p>
          <p className="text-[#A08030] text-xs mt-0.5">
            {campanha.aguardando_count > 0
              ? `${campanha.aguardando_count} lead(s) na fila de espera`
              : "Nenhum lead na fila ainda"}
            {" · "}Pausada em {formatDate(campanha.pausado_at)}
          </p>
        </div>
      </div>
      {canWrite && (
        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="sm" onClick={() => onAction("retomar")} loading={pauseLoading === "retomar"} disabled={!!pauseLoading}>
            <PlayCircle className="w-4 h-4 mr-1.5" />Retomar campanha
          </Button>
          {campanha.aguardando_count > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => onAction("soltar-todos")} loading={pauseLoading === "soltar-todos"} disabled={!!pauseLoading}>
                <ChevronsRight className="w-4 h-4 mr-1.5" />Soltar todos ({campanha.aguardando_count})
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction("soltar-um")} loading={pauseLoading === "soltar-um"} disabled={!!pauseLoading}>
                <ListOrdered className="w-4 h-4 mr-1.5" />Soltar um
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
