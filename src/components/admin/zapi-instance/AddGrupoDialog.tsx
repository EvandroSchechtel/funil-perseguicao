"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Search, ChevronDown, CheckCircle2, Plus, Loader2,
  RefreshCw, X, Tag, Building2, ArrowRight, ArrowLeft,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { type Campanha, type ContaManychat, type ZApiWaGroup, type ManychatTag } from "./types"
import { toast } from "sonner"

// ── SearchableSelect (local, simplified) ─────────────────────────────────────

function SearchableSelect<T>({
  options, value, onChange, getKey, getLabel,
  placeholder, searchPlaceholder = "Buscar...", loading: isLoading, disabled, label,
}: {
  options: T[]
  value: string
  onChange: (value: string, label: string) => void
  getKey: (item: T) => string
  getLabel: (item: T) => string
  placeholder: string
  searchPlaceholder?: string
  loading?: boolean
  disabled?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => getKey(o) === value)
  const filtered = options.filter((o) => (getLabel(o) ?? "").toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      {label && (
        <label className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest mb-1.5 block">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => { setOpen((v) => !v); setSearch("") }}
        className="flex h-10 w-full items-center justify-between rounded-lg border bg-[#13131F] px-3 py-2 text-sm border-[#1C1C2C] focus:border-[#25D366]/50 focus:outline-none transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#252535]"
      >
        <span className={selected ? "text-[#EEEEF5]" : "text-[#3F3F58]"}>
          {isLoading ? "Carregando..." : selected ? getLabel(selected) : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[#3F3F58] shrink-0" />
      </button>

      {open && !isLoading && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[#1C1C2C] bg-[#0F0F1A] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="p-2 border-b border-[#1C1C2C]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#3F3F58]" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#13131F] rounded-lg border border-[#1C1C2C] text-sm text-[#EEEEF5] placeholder-[#3F3F58] pl-7 pr-3 py-1.5 focus:outline-none focus:border-[#25D366]/40"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[#3F3F58] text-xs text-center py-4">Nenhum resultado</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={getKey(o)}
                  type="button"
                  onClick={() => { onChange(getKey(o), getLabel(o)); setOpen(false); setSearch("") }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[#13131F] transition-colors text-left gap-2"
                >
                  <span className="text-[#EEEEF5] truncate">{getLabel(o)}</span>
                  {getKey(o) === value && <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── AddGrupoDialog ───────────────────────────────────────────────────────────

interface AddGrupoDialogProps {
  open: boolean
  instanciaId: string
  clienteId: string | null
  campanhas: Campanha[]
  contas: ContaManychat[]
  accessToken: string | null
  onClose: () => void
  onSuccess: () => void
}

interface ContaRow {
  contaId: string
  contaNome: string
  tagId: number
  tagNome: string
  tags: ManychatTag[]
  loadingTags: boolean
}

export function AddGrupoDialog({
  open, instanciaId, clienteId, campanhas, contas, accessToken, onClose, onSuccess,
}: AddGrupoDialogProps) {
  // Step state
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 state
  const [campanhaId, setCampanhaId] = useState("")
  const [campanhaNome, setCampanhaNome] = useState("")
  const [zapiGroups, setZapiGroups] = useState<ZApiWaGroup[]>([])
  const [zapiGroupsLoading, setZapiGroupsLoading] = useState(false)
  const [gruposWaSelecionados, setGruposWaSelecionados] = useState<Array<{ nome: string; phone: string }>>([])
  const [grupoPickerFilter, setGrupoPickerFilter] = useState("")
  const [autoExpand, setAutoExpand] = useState(true)

  // Step 2 state
  const [contaRows, setContaRows] = useState<ContaRow[]>([])
  const [saving, setSaving] = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1)
      setCampanhaId("")
      setCampanhaNome("")
      setZapiGroups([])
      setGruposWaSelecionados([])
      setGrupoPickerFilter("")
      setAutoExpand(true)
      setContaRows([])
      setSaving(false)
    }
  }, [open])

  // ── Step 1: Fetch Z-API groups ────────────────────────────────────────────

  async function fetchZapiGroups(forceRefresh = false) {
    setZapiGroupsLoading(true)
    try {
      const url = `/api/admin/zapi/instancias/${instanciaId}/detectar-grupos${forceRefresh ? "?refresh=true" : ""}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (!res.ok) {
        toast.error("Erro ao buscar grupos do Z-API.")
        setZapiGroups([])
        return
      }
      const data = await res.json()
      setZapiGroups((data.grupos || []).filter((g: ZApiWaGroup) => g.name?.trim()))
    } catch {
      toast.error("Erro ao buscar grupos do Z-API.")
    } finally {
      setZapiGroupsLoading(false)
    }
  }

  // ── Step 2: Fetch tags for a conta ────────────────────────────────────────

  const fetchTagsForConta = useCallback(async (contaId: string, rowIndex: number) => {
    if (!accessToken || !contaId) return
    setContaRows((prev) =>
      prev.map((r, i) => i === rowIndex ? { ...r, loadingTags: true } : r)
    )
    try {
      const res = await fetch(
        `/api/admin/zapi/instancias/${instanciaId}/tags-manychat?conta_id=${contaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const data = await res.json()
      const tags: ManychatTag[] = data.tags || []
      setContaRows((prev) =>
        prev.map((r, i) => i === rowIndex ? { ...r, tags, loadingTags: false } : r)
      )
    } catch {
      toast.error("Erro ao buscar tags.")
      setContaRows((prev) =>
        prev.map((r, i) => i === rowIndex ? { ...r, loadingTags: false } : r)
      )
    }
  }, [accessToken, instanciaId])

  // ── Navigate to step 2 ────────────────────────────────────────────────────

  function handleGoToStep2() {
    if (!campanhaId || gruposWaSelecionados.length === 0) {
      toast.error("Selecione uma campanha e pelo menos um grupo.")
      return
    }
    // Initialize with one empty conta row
    setContaRows([{
      contaId: "", contaNome: "", tagId: 0, tagNome: "", tags: [], loadingTags: false,
    }])
    setStep(2)
  }

  function handleAddContaRow() {
    setContaRows((prev) => [
      ...prev,
      { contaId: "", contaNome: "", tagId: 0, tagNome: "", tags: [], loadingTags: false },
    ])
  }

  function handleRemoveContaRow(index: number) {
    if (contaRows.length <= 1) return // Cannot remove first row
    setContaRows((prev) => prev.filter((_, i) => i !== index))
  }

  function handleContaChange(index: number, contaId: string, contaNome: string) {
    setContaRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, contaId, contaNome, tagId: 0, tagNome: "", tags: [], loadingTags: false } : r
      )
    )
    if (contaId) {
      fetchTagsForConta(contaId, index)
    }
  }

  function handleTagChange(index: number, tagIdStr: string) {
    setContaRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        const tag = r.tags.find((t) => String(t.id) === tagIdStr)
        return {
          ...r,
          tagId: tag ? tag.id : 0,
          tagNome: tag ? tag.name : "",
        }
      })
    )
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    // Validate all rows have conta + tag
    const validRows = contaRows.filter((r) => r.contaId && r.tagId > 0)
    if (validRows.length === 0) {
      toast.error("Configure pelo menos uma conta com tag.")
      return
    }

    // Check for duplicate contas
    const contaIds = validRows.map((r) => r.contaId)
    if (new Set(contaIds).size !== contaIds.length) {
      toast.error("Remova contas duplicadas antes de salvar.")
      return
    }

    const [primary, ...rest] = validRows
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${instanciaId}/grupos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          campanha_id: campanhaId,
          conta_manychat_id: primary.contaId,
          tag_manychat_id: primary.tagId,
          tag_manychat_nome: primary.tagNome,
          auto_expand: autoExpand,
          grupos: gruposWaSelecionados,
          ...(rest.length > 0 && {
            contas_adicionais: rest.map((c) => ({
              conta_id: c.contaId,
              tag_id: c.tagId,
              tag_nome: c.tagNome,
            })),
          }),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Grupos configurados.")
        if (data.results?.some((r: { status: string }) => r.status === "duplicado")) {
          toast.warning("Alguns grupos já existiam e foram ignorados.")
        }
        if (data.autoVinculados?.length > 0) {
          toast.success(
            `Auto-vinculados: ${(data.autoVinculados as string[]).length} grupo(s) similares encontrados.`,
            { duration: 6000 },
          )
        }
        onSuccess()
        onClose()
      } else {
        toast.error(data.message || "Erro ao configurar grupos.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSaving(false)
    }
  }

  // ── Filtered groups ────────────────────────────────────────────────────────

  const filteredGroups = zapiGroups.filter((g) =>
    g.name.toLowerCase().includes(grupoPickerFilter.toLowerCase())
  )
  const allFiltered = filteredGroups.length > 0 && filteredGroups.every((g) =>
    gruposWaSelecionados.some((s) => s.nome === g.name)
  )

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Selecionar Grupo" : "Configurar Contas"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-[#5A5A72] mb-2">
          <span className={step === 1 ? "text-[#25D366] font-semibold" : ""}>1. Grupos</span>
          <ArrowRight className="w-3 h-3" />
          <span className={step === 2 ? "text-[#25D366] font-semibold" : ""}>2. Contas</span>
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Campaign selector */}
            <SearchableSelect<Campanha>
              label="Campanha *"
              options={campanhas}
              value={campanhaId}
              getKey={(c) => c.id}
              getLabel={(c) => c.nome}
              placeholder="Selecionar campanha..."
              searchPlaceholder="Buscar campanha..."
              onChange={(val, label) => { setCampanhaId(val); setCampanhaNome(label) }}
            />

            {/* Detect groups button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest">
                  Grupos WhatsApp *
                </label>
                <button
                  type="button"
                  onClick={() => fetchZapiGroups(true)}
                  className="text-[#25D366] hover:text-[#1DB954] text-[10px] font-medium flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${zapiGroupsLoading ? "animate-spin" : ""}`} />
                  Recarregar
                </button>
              </div>

              {zapiGroups.length === 0 && !zapiGroupsLoading && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fetchZapiGroups()}
                  loading={zapiGroupsLoading}
                >
                  Buscar Grupos do WhatsApp
                </Button>
              )}

              {/* Search filter */}
              {(zapiGroups.length > 0 || zapiGroupsLoading) && (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#3F3F58]" />
                    <input
                      value={grupoPickerFilter}
                      onChange={(e) => setGrupoPickerFilter(e.target.value)}
                      placeholder="Filtrar por nome..."
                      className="w-full h-8 pl-7 pr-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-xs text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/50 transition-colors"
                    />
                  </div>

                  {/* Select all / deselect filtered */}
                  {filteredGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (allFiltered) {
                          setGruposWaSelecionados((prev) => prev.filter((s) => !filteredGroups.some((g) => g.name === s.nome)))
                        } else {
                          const newEntries = filteredGroups
                            .filter((g) => !gruposWaSelecionados.some((s) => s.nome === g.name))
                            .map((g) => ({ nome: g.name, phone: g.phone }))
                          setGruposWaSelecionados((prev) => [...prev, ...newEntries])
                        }
                      }}
                      className="text-[10px] font-medium text-[#25D366] hover:text-[#1DB954] transition-colors"
                    >
                      {allFiltered ? `Desmarcar filtrados (${filteredGroups.length})` : `Selecionar todos filtrados (${filteredGroups.length})`}
                    </button>
                  )}

                  {/* Checkbox list */}
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-[#1C1C2C] bg-[#0A0A12] divide-y divide-[#1C1C2C]">
                    {zapiGroupsLoading ? (
                      <p className="text-center text-[#3F3F58] text-xs py-4">Carregando grupos...</p>
                    ) : filteredGroups.length === 0 ? (
                      <p className="text-center text-[#3F3F58] text-xs py-4">
                        {zapiGroups.length === 0 ? "Nenhum grupo encontrado" : "Nenhum resultado"}
                      </p>
                    ) : (
                      filteredGroups.map((g) => {
                        const checked = gruposWaSelecionados.some((s) => s.nome === g.name)
                        return (
                          <label
                            key={g.phone}
                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#13131F] transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setGruposWaSelecionados((prev) =>
                                  checked ? prev.filter((s) => s.nome !== g.name) : [...prev, { nome: g.name, phone: g.phone }]
                                )
                              }
                              className="w-3.5 h-3.5 accent-[#25D366] shrink-0"
                            />
                            <span className="text-xs text-[#EEEEF5] truncate">{g.name}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </>
              )}

              {/* Counter + auto-expand */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#25D366]">
                  {gruposWaSelecionados.length > 0 ? `${gruposWaSelecionados.length} selecionado(s)` : ""}
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoExpand}
                    onChange={(e) => setAutoExpand(e.target.checked)}
                    className="w-3 h-3 accent-[#25D366]"
                  />
                  <span className="text-[10px] text-[#7F7F9E]">Auto-expandir grupos similares</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-[#7F7F9E] leading-relaxed">
              O sistema rastreia qual conta Manychat enviou o flow. Quando o lead entra no grupo, a tag é aplicada na conta correspondente.
            </p>

            {/* Conta rows */}
            <div className="space-y-3">
              {contaRows.map((row, index) => (
                <div key={index} className="p-3 bg-[#0A0A12] border border-[#1C1C2C] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest flex items-center gap-1.5">
                      <Building2 className="w-3 h-3" />
                      Conta {index + 1}
                    </span>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContaRow(index)}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#3F3F58] hover:text-[#F87171] transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Conta select — filtra contas já selecionadas em outras linhas */}
                  <SearchableSelect<ContaManychat>
                    options={contas.filter((c) =>
                      c.id === row.contaId || !contaRows.some((r, i) => i !== index && r.contaId === c.id)
                    )}
                    value={row.contaId}
                    getKey={(c) => c.id}
                    getLabel={(c) => c.nome}
                    placeholder="Selecionar conta..."
                    searchPlaceholder="Buscar conta..."
                    onChange={(val, label) => handleContaChange(index, val, label)}
                  />

                  {/* Tag select */}
                  {row.contaId && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-[#A78BFA]" />
                        <span className="text-[10px] font-semibold text-[#3F3F58] uppercase tracking-widest">
                          Tag de entrada
                        </span>
                        {row.loadingTags && <Loader2 className="w-3 h-3 animate-spin text-[#25D366]" />}
                      </div>
                      {row.loadingTags ? (
                        <div className="flex items-center gap-2 text-xs text-[#5A5A72] py-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Buscando tags...
                        </div>
                      ) : row.tags.length === 0 ? (
                        <p className="text-xs text-[#5A5A72]">Nenhuma tag encontrada para esta conta.</p>
                      ) : (
                        <SearchableSelect<ManychatTag>
                          options={row.tags}
                          value={String(row.tagId || "")}
                          getKey={(t) => String(t.id)}
                          getLabel={(t) => t.name}
                          placeholder="Selecionar tag..."
                          searchPlaceholder="Buscar tag..."
                          onChange={(val) => handleTagChange(index, val)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add another conta */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAddContaRow}
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar outra conta
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={handleGoToStep2}
                disabled={!campanhaId || gruposWaSelecionados.length === 0}
              >
                Próximo
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Voltar
              </Button>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={contaRows.every((r) => !r.contaId || r.tagId <= 0)}
              >
                Salvar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
