"use client"

import { Webhook, Users2, DoorOpen } from "lucide-react"
import { type CampanhaData, formatDate } from "./types"

interface VisaoGeralSectionProps {
  campanha: CampanhaData
}

export function VisaoGeralSection({ campanha }: VisaoGeralSectionProps) {
  return (
    <section className="space-y-4">
      <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold">Visão Geral</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Webhooks", value: campanha.webhooks_count, icon: <Webhook className="w-4 h-4 text-[#7F7F9E]" /> },
          { label: "Leads recebidos", value: campanha.leads_count, icon: <Users2 className="w-4 h-4 text-[#7F7F9E]" /> },
          {
            label: "Entradas no grupo",
            value: campanha.grupos_entrados_count,
            icon: <DoorOpen className="w-4 h-4 text-[#25D366]" />,
            suffix: campanha.leads_count > 0
              ? <span className="text-xs font-semibold ml-1" style={{ color: campanha.grupos_entrados_count / campanha.leads_count >= 0.6 ? "#25D366" : campanha.grupos_entrados_count / campanha.leads_count >= 0.3 ? "#F59E0B" : "#F87171" }}>
                  {((campanha.grupos_entrados_count / campanha.leads_count) * 100).toFixed(1)}%
                </span>
              : null,
          },
        ].map((s) => (
          <div key={s.label} className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl px-4 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#13131F] flex items-center justify-center shrink-0">{s.icon}</div>
            <div>
              <div className="flex items-baseline">
                <p className="text-xl font-bold text-[#EEEEF5] leading-none">{s.value}</p>
                {"suffix" in s ? s.suffix : null}
              </div>
              <p className="text-[#7F7F9E] text-[10px] mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 space-y-4">
        {campanha.descricao && (
          <div>
            <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Descrição</p>
            <p className="text-[#C4C4D4] text-sm">{campanha.descricao}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Criado por</p>
            <p className="text-[#C4C4D4] text-sm">{campanha.usuario.nome}</p>
          </div>
          <div>
            <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Criado em</p>
            <p className="text-[#C4C4D4] text-sm">{formatDate(campanha.created_at)}</p>
          </div>
          {campanha.data_inicio && (
            <div>
              <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Início</p>
              <p className="text-[#C4C4D4] text-sm">{formatDate(campanha.data_inicio)}</p>
            </div>
          )}
          {campanha.data_fim && (
            <div>
              <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Fim</p>
              <p className="text-[#C4C4D4] text-sm">{formatDate(campanha.data_fim)}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
