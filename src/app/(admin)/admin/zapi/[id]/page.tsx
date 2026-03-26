"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

import { type ZApiInstance, type ZApiGrupo, type Campanha, type ContaManychat } from "@/components/admin/zapi-instance/types"
import { HeroCard } from "@/components/admin/zapi-instance/HeroCard"
import { EditInstanceDialog } from "@/components/admin/zapi-instance/EditInstanceDialog"
import { GruposListSection } from "@/components/admin/zapi-instance/GruposListSection"
import { AddGrupoDialog } from "@/components/admin/zapi-instance/AddGrupoDialog"
import { EditGrupoDialog } from "@/components/admin/EditGrupoDialog"
import { EntradasTable } from "@/components/admin/zapi-instance/EntradasTable"
import { SaidasTable } from "@/components/admin/zapi-instance/SaidasTable"

// ── TabButton ────────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, count, children,
}: {
  active: boolean
  onClick: () => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-[#0F0F1A] text-[#EEEEF5] shadow-sm"
          : "text-[#3F3F58] hover:text-[#7F7F9E]"
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          active ? "bg-[#25D366]/15 text-[#25D366]" : "bg-[#13131F] text-[#3F3F58]"
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InstanciaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { accessToken, user } = useAuth()

  const [inst, setInst] = useState<ZApiInstance | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [contas, setContas] = useState<ContaManychat[]>([])

  // Top-level UI state
  const [activeTab, setActiveTab] = useState<"grupos" | "entradas" | "saidas">("grupos")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editGrupo, setEditGrupo] = useState<ZApiGrupo | null>(null)
  const [showEditInst, setShowEditInst] = useState(false)
  const [grupoFiltro, setGrupoFiltro] = useState<string | null>(null)

  const canWrite = user ? hasPermission(user.role, "contas:write") : false

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchInst = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Instância não encontrada")
      const data = await res.json()
      setInst(data.instancia)
      setWebhookUrl(data.webhook_url || "")

      // Fetch campanhas and contas filtered by this instance's client
      const clienteId = data.instancia?.cliente?.id
      const clienteParam = clienteId ? `&cliente_id=${clienteId}` : ""
      const [cr, conr] = await Promise.all([
        fetch(`/api/admin/campanhas?per_page=200${clienteParam}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/admin/contas?per_page=200${clienteParam}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      const cd = await cr.json()
      const cond = await conr.json()
      setCampanhas(cd.data || [])
      setContas(cond.contas || [])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [accessToken, id])

  useEffect(() => { fetchInst() }, [fetchInst])

  // ── Callbacks ──────────────────────────────────────────────────────────────

  function handleViewEntradas(grupoId: string) {
    setGrupoFiltro(grupoId)
    setActiveTab("entradas")
  }

  // Adapt ZApiGrupo to the shape expected by EditGrupoDialog (GrupoMonitoramento from campanha/types)
  function grupoToEditShape(grupo: ZApiGrupo) {
    return {
      ...grupo,
      instancia: { id: inst!.id, nome: inst!.nome },
      conta_manychat: grupo.conta_manychat ?? { id: "", nome: "" },
      _count: grupo._count ?? { entradas: 0 },
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Z-API", href: "/admin/zapi" }, { label: "..." }]} />
        <div className="flex items-center justify-center flex-1">
          <div className="space-y-3 text-center">
            <div className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[#7F7F9E] text-sm">Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!inst) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Z-API", href: "/admin/zapi" }]} />
        <div className="p-6">
          <p className="text-[#F87171] text-sm">Instância não encontrada.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/admin/zapi")}>
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Z-API / WhatsApp", href: "/admin/zapi" },
          { label: inst.nome },
        ]}
      />

      <div className="flex-1 overflow-auto">
        <div className="px-6 pt-6 pb-10 max-w-4xl space-y-5">
          <Link
            href="/admin/zapi"
            className="inline-flex items-center gap-2 text-[#7F7F9E] hover:text-[#EEEEF5] text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Z-API
          </Link>

          {/* Hero Card */}
          <HeroCard
            inst={inst}
            webhookUrl={webhookUrl}
            canWrite={canWrite}
            onEdit={() => setShowEditInst(true)}
          />

          {/* Tabs */}
          <div className="flex gap-0.5 bg-[#0A0A12] border border-[#1C1C2C] rounded-xl p-1 w-fit">
            <TabButton active={activeTab === "grupos"} onClick={() => setActiveTab("grupos")} count={inst.grupos.length}>
              Grupos Monitorados
            </TabButton>
            <TabButton active={activeTab === "entradas"} onClick={() => setActiveTab("entradas")}>
              Entradas
            </TabButton>
            <TabButton active={activeTab === "saidas"} onClick={() => setActiveTab("saidas")}>
              Saídas
            </TabButton>
          </div>

          {/* Tab content */}
          {activeTab === "grupos" && (
            <GruposListSection
              inst={inst}
              accessToken={accessToken}
              canWrite={canWrite}
              onRefresh={fetchInst}
              onOpenAddDialog={() => setShowAddDialog(true)}
              onEditGrupo={setEditGrupo}
              onViewEntradas={handleViewEntradas}
            />
          )}
          {activeTab === "entradas" && (
            <EntradasTable
              instanciaId={inst.id}
              grupos={inst.grupos}
              accessToken={accessToken}
              initialGrupoFilter={grupoFiltro}
            />
          )}
          {activeTab === "saidas" && (
            <SaidasTable
              instanciaId={inst.id}
              grupos={inst.grupos}
              accessToken={accessToken}
            />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddGrupoDialog
        open={showAddDialog}
        instanciaId={inst.id}
        clienteId={inst.cliente?.id ?? null}
        campanhas={campanhas}
        contas={contas}
        accessToken={accessToken}
        onClose={() => setShowAddDialog(false)}
        onSuccess={fetchInst}
      />

      <EditGrupoDialog
        open={!!editGrupo}
        grupo={editGrupo ? grupoToEditShape(editGrupo) : null}
        accessToken={accessToken}
        onClose={() => setEditGrupo(null)}
        onSuccess={fetchInst}
      />

      <EditInstanceDialog
        open={showEditInst}
        inst={inst}
        accessToken={accessToken}
        onClose={() => setShowEditInst(false)}
        onSuccess={fetchInst}
      />
    </div>
  )
}
