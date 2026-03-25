"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Search, ChevronDown, CheckCircle2, AlertCircle, Plus, Loader2,
  Wifi, Tag, Info, RefreshCw, X,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GrupoConfig {
  instanciaId: string
  instanciaNome: string
  grupoId: string
  grupoNome: string
  nomeFiltro: string
  contas: Array<{
    contaId: string
    contaNome: string
    tagId: number
    tagNome: string
  }>
}

interface InstanciaZApi { id: string; nome: string; instance_id: string; cliente_id?: string | null }
interface ContaManychat { id: string; nome: string; page_name: string | null }
interface ZApiGroup { phone: string; name: string; isGroup: boolean }
interface ManychatTag { id: number; name: string }

// ── FieldInfo ─────────────────────────────────────────────────────────────────

export function FieldInfo({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-4 h-4 rounded-full border border-[#3F3F58] text-[#3F3F58] hover:border-[#25D366] hover:text-[#25D366] transition-colors flex items-center justify-center text-[9px] font-bold shrink-0"
        title={title}
      >
        ?
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#EEEEF5]">
              <Info className="w-4 h-4 text-[#25D366]" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-[#9898B0] space-y-2 py-1">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── SearchableSelect ──────────────────────────────────────────────────────────

export function SearchableSelect<T>({
  options, value, onChange, getKey, getLabel, placeholder,
  searchPlaceholder = "Buscar...", loading: isLoading, disabled, error, zIndex,
}: {
  options: T[]; value: string; onChange: (v: string) => void
  getKey: (i: T) => string; getLabel: (i: T) => string
  placeholder: string; searchPlaceholder?: string
  loading?: boolean; disabled?: boolean; error?: string; zIndex?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => getKey(o) === value)
  const filtered = options.filter((o) => getLabel(o).toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch("") }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => { setOpen((v) => !v); setSearch("") }}
        className={`flex h-10 w-full items-center justify-between rounded-lg border bg-[#13131F] px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#252535] focus:outline-none ${error ? "border-[#F87171]" : "border-[#1C1C2C] focus:border-[#25D366]/50"}`}
      >
        <span className={selected ? "text-[#EEEEF5]" : "text-[#3F3F58]"}>
          {isLoading ? "Carregando…" : selected ? getLabel(selected) : placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[#3F3F58] shrink-0" />
      </button>
      {open && !isLoading && (
        <div className={`absolute ${zIndex ?? "z-50"} mt-1 w-full rounded-xl border border-[#1C1C2C] bg-[#0F0F1A] shadow-[0_8px_32px_rgba(0,0,0,0.6)]`}>
          <div className="p-2 border-b border-[#1C1C2C]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#3F3F58]" />
              <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-[#13131F] rounded-lg border border-[#1C1C2C] text-sm text-[#EEEEF5] placeholder-[#3F3F58] pl-7 pr-3 py-1.5 focus:outline-none focus:border-[#25D366]/40"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[#3F3F58] text-xs text-center py-4">Nenhum resultado</p>
            ) : filtered.map((o) => (
              <button key={getKey(o)} type="button"
                onClick={() => { onChange(getKey(o)); setOpen(false); setSearch("") }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-[#13131F] transition-colors text-left gap-2"
              >
                <span className="text-[#EEEEF5] truncate">{getLabel(o)}</span>
                {getKey(o) === value && <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-[#F87171] mt-1.5">{error}</p>}
    </div>
  )
}

// ── AddGrupoForm ──────────────────────────────────────────────────────────────

export function AddGrupoForm({
  instancias, contas, accessToken, onAdd,
}: {
  instancias: InstanciaZApi[]
  contas: ContaManychat[]
  accessToken: string | null
  onAdd: (g: GrupoConfig) => void
}) {
  const [instanciaId, setInstanciaId] = useState("")
  const [zapiGroups, setZapiGroups] = useState<ZApiGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [grupoId, setGrupoId] = useState("")
  const [grupoNome, setGrupoNome] = useState("")
  const [contaId, setContaId] = useState("")
  const [tags, setTags] = useState<ManychatTag[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [tagId, setTagId] = useState("")
  const [tagNome, setTagNome] = useState("")
  const [nomeFiltro, setNomeFiltro] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newTagName, setNewTagName] = useState("")
  const [creatingTag, setCreatingTag] = useState(false)
  const [contasAdicionadas, setContasAdicionadas] = useState<GrupoConfig["contas"]>([])

  async function fetchGroups(id: string) {
    if (!id || !accessToken) return
    setLoadingGroups(true); setZapiGroups([]); setGrupoId(""); setGrupoNome("")
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${id}/detectar-grupos`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setZapiGroups((data.grupos || []).filter((g: ZApiGroup) => g.isGroup))
    } catch { toast.error("Erro ao buscar grupos.") }
    finally { setLoadingGroups(false) }
  }

  async function fetchTags(cId: string, iId: string) {
    if (!cId || !iId || !accessToken) return
    setLoadingTags(true); setTags([]); setTagId(""); setTagNome("")
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${iId}/tags-manychat?conta_id=${cId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setTags(data.tags || [])
    } catch { toast.error("Erro ao buscar tags.") }
    finally { setLoadingTags(false) }
  }

  // Auto-fetch tags when both contaId and instanciaId are set
  useEffect(() => {
    if (contaId && instanciaId) {
      fetchTags(contaId, instanciaId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaId, instanciaId])

  async function handleCreateTag() {
    if (!contaId || !newTagName.trim()) return
    setCreatingTag(true)
    try {
      const res = await fetch(`/api/admin/contas/${contaId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ nome: newTagName.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.tag) {
        const newTag: ManychatTag = data.tag
        setTags((prev) => [...prev, newTag])
        setTagId(String(newTag.id))
        setTagNome(newTag.name)
        setNewTagName("")
        toast.success(`Tag "${newTag.name}" criada com sucesso.`)
      } else {
        toast.error(data.message || "Erro ao criar tag.")
      }
    } catch { toast.error("Erro de conexão.") }
    finally { setCreatingTag(false) }
  }

  function handleAdicionarConta() {
    const errs: Record<string, string> = {}
    if (!contaId) errs.conta = "Selecione uma conta Manychat"
    if (!tagId) errs.tag = "Selecione uma tag"
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    // Check for duplicate conta
    if (contasAdicionadas.some((c) => c.contaId === contaId)) {
      setErrors({ conta: "Esta conta já foi adicionada" })
      return
    }
    setErrors({})

    const conta = contas.find((c) => c.id === contaId)
    const tag = tags.find((t) => String(t.id) === tagId)

    setContasAdicionadas((prev) => [
      ...prev,
      { contaId, contaNome: conta?.nome || "", tagId: Number(tagId), tagNome: tag?.name || tagNome },
    ])
    setContaId(""); setTags([]); setTagId(""); setTagNome(""); setNewTagName("")
  }

  function handleSalvarGrupo() {
    const errs: Record<string, string> = {}
    if (!instanciaId) errs.instancia = "Selecione uma instância"
    if (!grupoId) errs.grupo = "Selecione um grupo"
    if (!nomeFiltro.trim()) errs.filtro = "Informe o nome do grupo para filtro"
    if (contasAdicionadas.length === 0) errs.contas = "Adicione pelo menos uma conta Manychat"
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    const instancia = instancias.find((i) => i.id === instanciaId)

    onAdd({
      instanciaId, instanciaNome: instancia?.nome || "",
      grupoId, grupoNome,
      nomeFiltro: nomeFiltro.trim(),
      contas: contasAdicionadas,
    })

    setInstanciaId(""); setZapiGroups([]); setGrupoId(""); setGrupoNome("")
    setContaId(""); setTags([]); setTagId(""); setTagNome(""); setNomeFiltro("")
    setNewTagName(""); setContasAdicionadas([])
  }

  if (instancias.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 bg-[#13131F] border border-[#1C1C2C] rounded-xl text-sm text-[#5A5A72]">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Nenhuma instância Z-API vinculada a este cliente.</span>
      </div>
    )
  }

  return (
    <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-5 space-y-4">
      <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">Adicionar grupo</p>

      {/* Instância */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
          Instância Z-API
          <FieldInfo title="Instância Z-API">
            <p>A instância Z-API é o WhatsApp conectado ao sistema. Selecione a instância que tem acesso ao grupo que deseja monitorar.</p>
          </FieldInfo>
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchableSelect
              options={instancias}
              value={instanciaId}
              onChange={(v) => { setInstanciaId(v); setZapiGroups([]); setGrupoId(""); setGrupoNome("") }}
              getKey={(i) => i.id}
              getLabel={(i) => i.nome}
              placeholder="Selecionar instância"
              error={errors.instancia}
            />
          </div>
          <Button type="button" variant="outline" size="sm"
            disabled={!instanciaId || loadingGroups}
            onClick={() => fetchGroups(instanciaId)}
            className="shrink-0 h-10"
          >
            {loadingGroups ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
            Detectar grupos
          </Button>
        </div>
      </div>

      {/* Grupo */}
      {(zapiGroups.length > 0 || grupoId) && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
            Grupo WhatsApp
            <FieldInfo title="Grupo WhatsApp">
              <p>Selecione o grupo que os leads do lançamento vão entrar. O sistema vai monitorar todas as entradas neste grupo.</p>
            </FieldInfo>
          </label>
          <SearchableSelect
            options={zapiGroups}
            value={grupoId}
            onChange={(v) => {
              setGrupoId(v)
              const g = zapiGroups.find((g) => g.phone === v)
              const name = g?.name || ""
              setGrupoNome(name); setNomeFiltro(name)
            }}
            getKey={(g) => g.phone}
            getLabel={(g) => g.name}
            placeholder="Selecionar grupo"
            searchPlaceholder="Buscar grupo..."
            error={errors.grupo}
          />
        </div>
      )}

      {/* Nome filtro */}
      {grupoId && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
            Nome do grupo (filtro)
            <FieldInfo title="Nome do grupo para filtro">
              <p>Este nome é usado para filtrar os webhooks do Z-API. Apenas entradas em grupos cujo nome contém este texto são registradas.</p>
            </FieldInfo>
          </label>
          <input
            type="text"
            value={nomeFiltro}
            onChange={(e) => setNomeFiltro(e.target.value)}
            placeholder="Ex: Lançamento Produto X"
            className={`w-full h-10 px-3 rounded-lg border bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none transition-all ${errors.filtro ? "border-[#F87171]" : "border-[#1C1C2C] focus:border-[#25D366]/50"}`}
          />
          {errors.filtro && <p className="text-xs text-[#F87171]">{errors.filtro}</p>}
        </div>
      )}

      {/* Conta Manychat */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
          Conta Manychat
          <FieldInfo title="Conta Manychat">
            <p>A conta Manychat que vai receber os leads e aplicar as tags de automação.</p>
          </FieldInfo>
        </label>
        <SearchableSelect
          options={contas}
          value={contaId}
          onChange={(v) => { setContaId(v); setTags([]); setTagId(""); setTagNome("") }}
          getKey={(c) => c.id}
          getLabel={(c) => c.nome}
          placeholder="Selecionar conta"
          error={errors.conta}
        />
      </div>

      {/* Tag de entrada */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
          Tag de entrada
          {loadingTags && <Loader2 className="w-3 h-3 animate-spin text-[#25D366]" />}
          <FieldInfo title="Tag de entrada (Manychat)">
            <p>Esta tag será aplicada automaticamente no Manychat quando o lead entrar no grupo de WhatsApp.</p>
          </FieldInfo>
          {contaId && instanciaId && !loadingTags && (
            <button
              type="button"
              onClick={() => fetchTags(contaId, instanciaId)}
              className="ml-auto text-[#3F3F58] hover:text-[#25D366] transition-colors"
              title="Atualizar tags"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </label>
        <SearchableSelect
          options={tags}
          value={tagId}
          onChange={(v) => { setTagId(v); setTagNome(tags.find((t) => String(t.id) === v)?.name || "") }}
          getKey={(t) => String(t.id)}
          getLabel={(t) => t.name}
          placeholder={!contaId ? "Selecione a conta primeiro" : loadingTags ? "Buscando tags…" : tags.length === 0 ? "Nenhuma tag — crie abaixo" : "Selecionar tag"}
          searchPlaceholder="Buscar tag..."
          loading={loadingTags}
          disabled={!contaId}
          error={errors.tag}
        />
        {/* Criar tag inline */}
        {contaId && !loadingTags && (
          <div className="flex gap-2 mt-1">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag() } }}
              placeholder="Nome da nova tag…"
              className="flex-1 h-8 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-xs text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/50 transition-colors"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs shrink-0"
              disabled={!newTagName.trim() || creatingTag}
              onClick={handleCreateTag}
            >
              {creatingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Criar tag
            </Button>
          </div>
        )}
      </div>

      {/* Adicionar conta button */}
      <Button type="button" onClick={handleAdicionarConta} className="w-full" variant="outline">
        <Plus className="w-4 h-4" />
        Adicionar conta
      </Button>

      {/* Lista de contas adicionadas */}
      {contasAdicionadas.length > 0 && (
        <div className="space-y-2">
          <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5">
            <Tag className="w-3 h-3" />
            Contas configuradas ({contasAdicionadas.length})
          </p>
          {contasAdicionadas.map((c) => (
            <div key={c.contaId} className="flex items-center gap-2 px-3 py-2 bg-[#13131F] border border-[#1C1C2C] rounded-lg">
              <span className="w-2 h-2 rounded-full bg-[#25D366] shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-[#EEEEF5] truncate block">{c.contaNome}</span>
                <span className="text-[10px] text-[#3F3F58] truncate block">{c.tagNome}</span>
              </div>
              <button
                type="button"
                onClick={() => setContasAdicionadas((prev) => prev.filter((x) => x.contaId !== c.contaId))}
                className="w-6 h-6 flex items-center justify-center rounded text-[#3F3F58] hover:text-[#F87171] transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {errors.contas && <p className="text-xs text-[#F87171]">{errors.contas}</p>}
        </div>
      )}
      {errors.contas && contasAdicionadas.length === 0 && (
        <p className="text-xs text-[#F87171]">{errors.contas}</p>
      )}

      {/* Salvar grupo */}
      <Button
        type="button"
        onClick={handleSalvarGrupo}
        className="w-full"
        disabled={contasAdicionadas.length === 0 || !grupoId}
      >
        <CheckCircle2 className="w-4 h-4" />
        Salvar grupo
      </Button>
    </div>
  )
}
