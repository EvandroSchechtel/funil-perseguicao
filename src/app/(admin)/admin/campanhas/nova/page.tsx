"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, AlertCircle,
  Copy, Plus, Trash2, Users, Tag, X, ExternalLink,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"
import { AddGrupoForm, FieldInfo, SearchableSelect, type GrupoConfig } from "@/components/admin/AddGrupoForm"

// ── Types ───────────────────────────────────────────────────────────────────

interface Cliente { id: string; nome: string }
interface InstanciaZApi { id: string; nome: string; instance_id: string; cliente_id: string | null }
interface ContaManychat { id: string; nome: string; page_name: string | null }

// ── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ["Dados Básicos", "Grupos WhatsApp", "Revisão"]
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done ? "bg-[#25D366] text-[#0A0A12]"
                : active ? "bg-[#25D366]/20 border-2 border-[#25D366] text-[#25D366]"
                : "bg-[#13131F] border border-[#1C1C2C] text-[#3F3F58]"
              }`}>
                {done ? <Check className="w-3.5 h-3.5" /> : step}
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

// ── Checklist Item ───────────────────────────────────────────────────────────

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

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NovaCampanhaWizardPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [step, setStep] = useState(1)

  // Step 1 state
  const [nome, setNome] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [descricao, setDescricao] = useState("")
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({})

  // Data
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [instancias, setInstancias] = useState<InstanciaZApi[]>([])
  const [contas, setContas] = useState<ContaManychat[]>([])

  // Step 2 state
  const [grupos, setGrupos] = useState<GrupoConfig[]>([])

  // Step 3 / creation state
  const [creating, setCreating] = useState(false)
  const [criado, setCriado] = useState<{ campanhaId: string; webhookUrl: string; nome: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Load clientes
  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/clientes?per_page=200", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => setClientes(d.data || []))
      .catch(() => {})
      .finally(() => setLoadingClientes(false))
  }, [accessToken])

  // Load instancias when client changes
  const loadClienteData = useCallback(async (cId: string) => {
    if (!cId || !accessToken) return
    try {
      const [instRes, clienteRes] = await Promise.all([
        fetch("/api/admin/zapi/instancias", { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/admin/clientes/${cId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      const [instData, clienteData] = await Promise.all([instRes.json(), clienteRes.json()])
      const allInst: InstanciaZApi[] = instData.instancias || []
      setInstancias(allInst.filter((i) => i.cliente_id === cId))
      setContas(clienteData.data?.contas_manychat || [])
    } catch {}
  }, [accessToken])

  useEffect(() => {
    if (clienteId) loadClienteData(clienteId)
    else { setInstancias([]); setContas([]) }
    setGrupos([])
  }, [clienteId, loadClienteData])

  function validateStep1() {
    const errs: Record<string, string> = {}
    if (!nome.trim()) errs.nome = "Nome é obrigatório"
    if (!clienteId) errs.cliente = "Selecione um cliente"
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
          cliente_id: clienteId || null,
        }),
      })
      const campData = await campRes.json()
      if (!campRes.ok) {
        toast.error(campData.message || "Erro ao criar campanha.")
        return
      }

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
              conta_manychat_id: g.contaManychatId,
              nome_filtro: g.nomeFiltro,
              tag_manychat_id: g.tagId,
              tag_manychat_nome: g.tagNome,
            }),
          })
          if (!res.ok) gruposErrors.push(g.grupoNome)
        } catch {
          gruposErrors.push(g.grupoNome)
        }
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
    } catch {}
  }

  // ── Success screen ──────────────────────────────────────────────────────

  if (criado) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Campanhas", href: "/admin/campanhas" }, { label: "Nova Campanha" }]} />
        <div className="p-6 max-w-lg">
          <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.45)] p-8 space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
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
                    <span className="text-[#25D366] truncate">{g.tagNome}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push("/admin/campanhas")} className="flex-1">
                Ver Campanhas
              </Button>
              <Button onClick={() => router.push(`/admin/campanhas/${criado.campanhaId}/editar`)} className="flex-1">
                <ExternalLink className="w-4 h-4" />
                Abrir Campanha
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Wizard ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Campanhas", href: "/admin/campanhas" }, { label: "Nova Campanha" }]} />

      <div className="p-6 max-w-2xl">
        <Link href="/admin/campanhas" className="inline-flex items-center gap-2 text-[#7F7F9E] hover:text-[#EEEEF5] text-sm mb-7 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Campanhas
        </Link>

        <div className="mb-7">
          <h1 className="text-[#EEEEF5] text-2xl font-bold">Nova Campanha</h1>
          <p className="text-[#7F7F9E] text-sm mt-1">Configure passo a passo o lançamento</p>
        </div>

        <StepIndicator current={step} total={3} />

        <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.45)] overflow-hidden">

          {/* ── Step 1: Dados Básicos ── */}
          {step === 1 && (
            <div>
              <div className="px-6 pt-6 pb-2">
                <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest mb-5">Dados da Campanha</p>
                <div className="space-y-4">

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
                      Nome da Campanha <span className="text-[#F87171]">*</span>
                      <FieldInfo title="Nome da Campanha">
                        <p>Identifique este lançamento. Use um nome descritivo que inclua o produto e o período.</p>
                        <p className="mt-1">Exemplo: "Lançamento Curso X — Junho 2025"</p>
                      </FieldInfo>
                    </label>
                    <Input
                      placeholder="Ex: Lançamento Produto X, Black Friday..."
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      error={step1Errors.nome}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
                      Cliente <span className="text-[#F87171]">*</span>
                      <FieldInfo title="Cliente">
                        <p>Vincule esta campanha a um cliente. Os grupos de WhatsApp e contas Manychat disponíveis serão filtrados para este cliente.</p>
                      </FieldInfo>
                    </label>
                    <SearchableSelect
                      options={clientes}
                      value={clienteId}
                      onChange={setClienteId}
                      getKey={(c) => c.id}
                      getLabel={(c) => c.nome}
                      placeholder="Selecionar cliente"
                      searchPlaceholder="Buscar cliente..."
                      loading={loadingClientes}
                      error={step1Errors.cliente}
                    />
                  </div>

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
              </div>
              <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
                <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
                <Button className="flex-1" onClick={() => { if (validateStep1()) setStep(2) }}>
                  Próximo — Grupos WhatsApp
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Grupos WhatsApp ── */}
          {step === 2 && (
            <div>
              <div className="px-6 pt-6 pb-2 space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">Grupos WhatsApp</p>
                    <p className="text-[#7F7F9E] text-xs mt-1">
                      Configure quais grupos do WhatsApp serão monitorados e qual tag aplicar no Manychat.
                    </p>
                  </div>
                  <FieldInfo title="Grupos WhatsApp">
                    <p>Cada grupo monitorado é um grupo de WhatsApp do lançamento. Quando um lead entra no grupo, o sistema detecta automaticamente e aplica a tag correspondente no Manychat.</p>
                    <p className="mt-1 text-[#F59E0B]">Este passo é opcional — você pode configurar os grupos depois, na tela de detalhes da campanha.</p>
                  </FieldInfo>
                </div>

                {/* Grupos já adicionados */}
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
                            <span className="text-[#25D366] truncate">{g.tagNome}</span>
                            <span>·</span>
                            <span className="truncate">{g.contaManychatNome}</span>
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

                {/* Add group form */}
                <AddGrupoForm
                  instancias={instancias}
                  contas={contas}
                  accessToken={accessToken}
                  onAdd={(g) => setGrupos((p) => [...p, g])}
                />
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
          {step === 3 && (
            <div>
              <div className="px-6 pt-6 pb-2 space-y-5">
                <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">Revisão e Aprovação</p>

                {/* Checklist */}
                <div className="space-y-2.5">
                  <CheckItem ok={!!nome.trim()} label={nome.trim() ? `Nome: ${nome.trim()}` : "Nome não definido"} />
                  <CheckItem ok={!!clienteId} label={clienteId ? `Cliente: ${clientes.find((c) => c.id === clienteId)?.nome || clienteId}` : "Cliente não selecionado"} />
                  <CheckItem ok={grupos.length > 0} warn={grupos.length === 0} label={grupos.length > 0 ? `${grupos.length} grupo(s) WhatsApp configurado(s)` : "Nenhum grupo WhatsApp — pode ser adicionado depois"} />
                  {grupos.length > 0 && grupos.every((g) => g.tagId) && (
                    <CheckItem ok label="Tags de entrada configuradas em todos os grupos" />
                  )}
                  <CheckItem ok label="Webhook será gerado automaticamente" />
                </div>

                {/* Summary */}
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
                          <span className="text-[#A78BFA] truncate">{g.tagNome}</span>
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
        </div>
      </div>
    </div>
  )
}
