"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, AlertCircle, Copy,
  Plus, Trash2, Users, Tag, X, ExternalLink, Lock,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { AddGrupoForm, FieldInfo, type GrupoConfig } from "@/components/admin/AddGrupoForm"

// ── Types ────────────────────────────────────────────────────────────────────

interface InstanciaZApi {
  id: string
  nome: string
  instance_id: string
  cliente_id: string | null
}

interface ContaManychat {
  id: string
  nome: string
  page_name: string | null
}

export interface NovaCampanhaDialogProps {
  open: boolean
  onClose: () => void
  clienteId: string
  clienteNome: string
  contasManychat: ContaManychat[]
}

// ── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ["Campanha", "Grupos WhatsApp", "Revisão"]
  return (
    <div className="flex items-center gap-0 mb-6">
      {labels.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done ? "bg-[#25D366] text-[#0A0A12]"
                : active ? "bg-[#25D366]/20 border-2 border-[#25D366] text-[#25D366]"
                : "bg-[#13131F] border border-[#1C1C2C] text-[#3F3F58]"
              }`}>
                {done ? <Check className="w-3 h-3" /> : step}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-[#EEEEF5]" : done ? "text-[#25D366]" : "text-[#3F3F58]"}`}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 transition-all ${done ? "bg-[#25D366]" : "bg-[#1C1C2C]"}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── CheckItem ────────────────────────────────────────────────────────────────

function CheckItem({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
        ok ? "bg-[#22C55E]/15 text-[#22C55E]"
        : warn ? "bg-[#F59E0B]/15 text-[#F59E0B]"
        : "bg-[#F87171]/15 text-[#F87171]"
      }`}>
        {ok ? <Check className="w-3 h-3" /> : warn ? <AlertCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
      </div>
      <span className={`text-sm ${ok ? "text-[#EEEEF5]" : warn ? "text-[#F59E0B]" : "text-[#9898B0]"}`}>{label}</span>
    </div>
  )
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export function NovaCampanhaDialog({ open, onClose, clienteId, clienteNome, contasManychat }: NovaCampanhaDialogProps) {
  const router = useRouter()
  const { accessToken } = useAuth()

  // Wizard state
  const [step, setStep] = useState(1)

  // Step 1
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({})

  // Step 2
  const [grupos, setGrupos] = useState<GrupoConfig[]>([])
  const [instancias, setInstancias] = useState<InstanciaZApi[]>([])
  const [loadingInstancias, setLoadingInstancias] = useState(false)

  // Step 3 / creation
  const [creating, setCreating] = useState(false)
  const [criado, setCriado] = useState<{ campanhaId: string; webhookUrl: string; nome: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Fetch instâncias when dialog opens
  const fetchInstancias = useCallback(async () => {
    if (!accessToken || !clienteId) return
    setLoadingInstancias(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias?cliente_id=${clienteId}&per_page=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setInstancias(data.instancias || [])
    } catch { /* silent */ }
    finally { setLoadingInstancias(false) }
  }, [accessToken, clienteId])

  useEffect(() => {
    if (open) fetchInstancias()
  }, [open, fetchInstancias])

  function resetState() {
    setStep(1)
    setNome(""); setDescricao(""); setStatus("ativo"); setDataInicio(""); setDataFim("")
    setStep1Errors({}); setGrupos([])
    setCriado(null); setCopied(false)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  function validateStep1() {
    const errs: Record<string, string> = {}
    if (!nome.trim()) errs.nome = "Nome é obrigatório"
    setStep1Errors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleCreate() {
    setCreating(true)
    try {
      // 1. Create campaign
      const campRes = await fetch("/api/admin/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          status,
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          cliente_id: clienteId,
        }),
      })
      const campData = await campRes.json()
      if (!campRes.ok) { toast.error(campData.message || "Erro ao criar campanha."); return }

      const campanhaId = campData.data?.id
      const webhookUrl = campData.webhook?.url_publica || ""

      // 2. Create monitoring groups
      const gruposErrors: string[] = []
      for (const g of grupos) {
        try {
          const res = await fetch(`/api/admin/zapi/instancias/${g.instanciaId}/grupos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              campanha_id: campanhaId,
              conta_manychat_id: g.contas[0].contaId,
              nome_filtro: g.nomeFiltro,
              tag_manychat_id: g.contas[0].tagId,
              tag_manychat_nome: g.contas[0].tagNome,
              ...(g.contas.length > 1 && {
                contas_adicionais: g.contas.slice(1).map((c) => ({
                  conta_id: c.contaId,
                  tag_id: c.tagId,
                  tag_nome: c.tagNome,
                })),
              }),
            }),
          })
          if (!res.ok) gruposErrors.push(g.grupoNome)
        } catch { gruposErrors.push(g.grupoNome) }
      }

      if (gruposErrors.length > 0) {
        toast.warning(`Campanha criada, mas ${gruposErrors.length} grupo(s) falharam: ${gruposErrors.join(", ")}`)
      }

      setCriado({ campanhaId, webhookUrl, nome: nome.trim() })
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setCreating(false)
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("URL copiada!")
    } catch { /* silent */ }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">

        {/* Header */}
        <div className="px-6 pt-6 pb-0 border-b border-[#1C1C2C]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-[#EEEEF5] text-lg font-bold">Nova Campanha</DialogTitle>
            <p className="text-[#7F7F9E] text-xs mt-0.5">
              Cliente: <span className="text-[#EEEEF5] font-medium">{clienteNome}</span>
            </p>
          </DialogHeader>
          {!criado && <StepIndicator current={step} total={3} />}
        </div>

        {/* ── Sucesso ── */}
        {criado && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-[#EEEEF5] text-xl font-bold">Campanha criada!</p>
                <p className="text-[#7F7F9E] text-sm mt-1">
                  <span className="text-[#EEEEF5]">{criado.nome}</span> está pronta para receber leads.
                </p>
              </div>
            </div>

            {criado.webhookUrl && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#3F3F58] uppercase tracking-widest">URL do Webhook</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-10 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-[#7F7F9E] text-xs flex items-center font-mono overflow-hidden">
                    <span className="truncate">{criado.webhookUrl}</span>
                  </div>
                  <Button type="button" variant="outline" className="shrink-0 h-10 px-3" onClick={() => handleCopy(criado.webhookUrl)}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-[#3F3F58]">Use esta URL no Manychat para enviar leads para esta campanha.</p>
              </div>
            )}

            {grupos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#3F3F58] uppercase tracking-widest">{grupos.length} grupo(s) configurado(s)</p>
                {grupos.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-[#9898B0]">
                    <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span className="truncate">{g.grupoNome}</span>
                    <span className="text-[#3F3F58]">→</span>
                    <span className="text-[#25D366] truncate">{g.contas.map((c) => c.contaNome).join(", ")}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Concluir
              </Button>
              <Button onClick={() => { handleClose(); router.push(`/admin/campanhas/${criado.campanhaId}`) }} className="flex-1">
                <ExternalLink className="w-4 h-4" />
                Abrir Campanha
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 1: Campanha ── */}
        {!criado && step === 1 && (
          <div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">Dados da Campanha</p>

              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9898B0]">
                  Nome da Campanha <span className="text-[#F87171]">*</span>
                </label>
                <input
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Lançamento Produto X, Black Friday..."
                  className={`w-full h-10 px-3 rounded-lg border bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none transition-all ${step1Errors.nome ? "border-[#F87171]" : "border-[#1C1C2C] focus:border-[#25D366]/50"}`}
                />
                {step1Errors.nome && <p className="text-xs text-[#F87171]">{step1Errors.nome}</p>}
              </div>

              {/* Cliente read-only */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
                  Cliente
                  <span className="flex items-center gap-0.5 text-[#3F3F58] text-[10px] font-normal">
                    <Lock className="w-2.5 h-2.5" />
                    fixo
                  </span>
                </label>
                <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-[#1C1C2C] bg-[#13131F] px-3 text-sm text-[#EEEEF5] opacity-70 cursor-not-allowed">
                  <Lock className="w-3.5 h-3.5 text-[#3F3F58] shrink-0" />
                  {clienteNome}
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9898B0]">Descrição (opcional)</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o objetivo desta campanha..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/50 transition-colors resize-none"
                />
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#9898B0]">Data de Início</label>
                  <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#9898B0]">Data de Fim</label>
                  <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50 transition-colors" />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-4 bg-[#13131F] border border-[#1C1C2C] rounded-xl">
                <div>
                  <p className="text-sm font-medium text-[#EEEEF5]">Status</p>
                  <p className="text-xs text-[#3F3F58] mt-0.5">
                    {status === "ativo" ? "Campanha ativa — aceita leads" : "Campanha inativa"}
                  </p>
                </div>
                <Switch checked={status === "ativo"} onCheckedChange={(c) => setStatus(c ? "ativo" : "inativo")} />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button className="flex-1" onClick={() => { if (validateStep1()) setStep(2) }}>
                Próximo — Grupos WhatsApp
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Grupos WhatsApp ── */}
        {!criado && step === 2 && (
          <div>
            <div className="px-6 py-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">Grupos WhatsApp</p>
                  <p className="text-[#7F7F9E] text-xs mt-1">
                    Configure quais grupos serão monitorados e qual tag aplicar no Manychat.
                  </p>
                </div>
                <FieldInfo title="Grupos WhatsApp">
                  <p>Cada grupo monitorado detecta entradas automaticamente e aplica a tag correspondente no Manychat.</p>
                  <p className="mt-1 text-[#F59E0B]">Este passo é opcional — pode configurar os grupos depois.</p>
                </FieldInfo>
              </div>

              {loadingInstancias ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full" />
                </div>
              ) : (
                <>
                  {/* Grupos adicionados */}
                  {grupos.length > 0 && (
                    <div className="space-y-2">
                      {grupos.map((g, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-[#13131F] border border-[#1C1C2C] rounded-xl">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                              <span className="text-[#EEEEF5] font-medium truncate">{g.grupoNome}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-[#5A5A72]">
                              <span className="truncate">{g.instanciaNome}</span>
                              <span>·</span>
                              <Tag className="w-3 h-3" />
                              <span className="text-[#25D366] truncate">{g.contas.map((c) => c.contaNome).join(", ")}</span>
                            </div>
                          </div>
                          <button type="button" onClick={() => setGrupos((p) => p.filter((_, j) => j !== i))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#3F3F58] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <AddGrupoForm
                    instancias={instancias}
                    contas={contasManychat}
                    accessToken={accessToken}
                    onAdd={(g) => setGrupos((p) => [...p, g])}
                  />
                </>
              )}
            </div>

            <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                {grupos.length === 0 ? "Pular — Revisar" : `Revisar (${grupos.length} grupo${grupos.length !== 1 ? "s" : ""})`}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Revisão ── */}
        {!criado && step === 3 && (
          <div>
            <div className="px-6 py-5 space-y-5">
              <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">Revisão e Aprovação</p>

              <div className="space-y-2.5">
                <CheckItem ok={!!nome.trim()} label={nome.trim() ? `Nome: ${nome.trim()}` : "Nome não definido"} />
                <CheckItem ok label={`Cliente: ${clienteNome}`} />
                <CheckItem
                  ok={grupos.length > 0}
                  warn={grupos.length === 0}
                  label={grupos.length > 0 ? `${grupos.length} grupo(s) WhatsApp configurado(s)` : "Nenhum grupo — pode ser adicionado depois"}
                />
                {grupos.length > 0 && grupos.every((g) => g.contas.length > 0) && (
                  <CheckItem ok label="Tags de entrada configuradas em todos os grupos" />
                )}
                <CheckItem ok label="Webhook será gerado automaticamente" />
              </div>

              <div className="bg-[#13131F] border border-[#1C1C2C] rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest">Resumo</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div><span className="text-[#5A5A72]">Nome</span><p className="text-[#EEEEF5] font-medium mt-0.5">{nome}</p></div>
                  <div><span className="text-[#5A5A72]">Status</span><p className={`font-medium mt-0.5 ${status === "ativo" ? "text-[#22C55E]" : "text-[#5A5A72]"}`}>{status === "ativo" ? "Ativa" : "Inativa"}</p></div>
                  {dataInicio && <div><span className="text-[#5A5A72]">Início</span><p className="text-[#EEEEF5] mt-0.5">{new Date(dataInicio).toLocaleDateString("pt-BR")}</p></div>}
                  {dataFim && <div><span className="text-[#5A5A72]">Fim</span><p className="text-[#EEEEF5] mt-0.5">{new Date(dataFim).toLocaleDateString("pt-BR")}</p></div>}
                  {descricao && <div className="col-span-2"><span className="text-[#5A5A72]">Descrição</span><p className="text-[#9898B0] mt-0.5">{descricao}</p></div>}
                </div>
                {grupos.length > 0 && (
                  <div className="pt-2 border-t border-[#1C1C2C] space-y-1.5">
                    {grupos.map((g, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[#7F7F9E]">
                        <Users className="w-3 h-3 text-[#25D366]" />
                        <span className="truncate">{g.grupoNome}</span>
                        <span className="text-[#3F3F58]">→</span>
                        <Tag className="w-3 h-3 text-[#A78BFA]" />
                        <span className="text-[#A78BFA] truncate">{g.contas.map((c) => c.contaNome).join(", ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button className="flex-1 shadow-lg shadow-[#25D366]/10" loading={creating} onClick={handleCreate}>
                <CheckCircle2 className="w-4 h-4" />
                Criar Campanha
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}
