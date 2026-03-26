"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Wifi, Building2, Lock, Users, Megaphone, Pencil, Copy,
} from "lucide-react"
import { type ZApiInstance } from "./types"
import { toast } from "sonner"

interface HeroCardProps {
  inst: ZApiInstance
  webhookUrl: string
  canWrite: boolean
  onEdit: () => void
}

export function HeroCard({ inst, webhookUrl, canWrite, onEdit }: HeroCardProps) {
  const [copied, setCopied] = useState(false)

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success("URL copiada!")
      })
      .catch(() => toast.error("Não foi possível copiar. Copie manualmente."))
  }

  return (
    <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.45)] overflow-hidden">
      {/* Top bar */}
      <div className="px-6 pt-6 pb-5 flex items-start gap-4">
        {/* Status icon */}
        <div className="relative shrink-0 mt-0.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${inst.status === "ativo" ? "bg-[#22C55E]/10" : "bg-[#13131F]"}`}>
            <Wifi className={`w-5 h-5 ${inst.status === "ativo" ? "text-[#22C55E]" : "text-[#3F3F58]"}`} />
          </div>
          {inst.status === "ativo" && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22C55E] shadow-[0_0_10px_rgba(34,197,94,0.7)] ring-2 ring-[#0F0F1A]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[#EEEEF5] text-lg font-bold">{inst.nome}</h1>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                inst.status === "ativo"
                  ? "text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20"
                  : "text-[#3F3F58] bg-[#13131F] border-[#1C1C2C]"
              }`}
            >
              {inst.status === "ativo" ? "Ativo" : "Inativo"}
            </span>
          </div>
          <p className="text-[#3F3F58] text-xs font-mono mt-1">{inst.instance_id}</p>

          {/* Client + stats row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {inst.cliente ? (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#7F7F9E]" />
                <Link
                  href={`/admin/clientes/${inst.cliente.id}`}
                  className="text-xs text-[#9898B0] hover:text-[#25D366] transition-colors font-medium"
                >
                  {inst.cliente.nome}
                </Link>
                <span title="Cliente imutável após criação">
                  <Lock className="w-2.5 h-2.5 text-[#3F3F58]" />
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#3F3F58]" />
                <span className="text-xs text-[#3F3F58] italic">Sem cliente vinculado</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#7F7F9E]" />
              <span className="text-xs text-[#9898B0]">
                {inst.grupos.length} {inst.grupos.length === 1 ? "grupo" : "grupos"} monitorados
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 text-[#7F7F9E]" />
              <span className="text-xs text-[#9898B0]">
                {new Set(inst.grupos.map((g) => g.campanha?.id).filter(Boolean)).size} campanhas
              </span>
            </div>
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 p-2 rounded-lg border border-[#1C1C2C] text-[#7F7F9E] hover:text-[#EEEEF5] hover:border-[#252535] transition-all"
            title="Editar instância"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Webhook URL */}
      {webhookUrl && (
        <div className="mx-6 mb-5 rounded-xl bg-[#0A0A12] border border-[#1C1C2C] p-3.5">
          <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest mb-2">
            Webhook URL — configure no painel Z-API
          </p>
          <div className="flex items-center gap-2">
            <code className="text-[#25D366] text-xs flex-1 truncate font-mono">{webhookUrl}</code>
            <button
              type="button"
              onClick={copyWebhook}
              className={`shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                copied
                  ? "text-[#22C55E] border-[#22C55E]/30 bg-[#22C55E]/10"
                  : "text-[#7F7F9E] border-[#1C1C2C] hover:border-[#252535] hover:text-[#EEEEF5]"
              }`}
            >
              <Copy className="w-3 h-3" />
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
