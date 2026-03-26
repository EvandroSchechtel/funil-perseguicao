"use client"

import React, { createContext, useContext, useState, useCallback, useRef } from "react"
import type { VarreduraProgressEvent, VarreduraResult } from "@/lib/services/varredura-grupos.service"

// ── Per-group state derived from progress events ────────────────────────────

export interface GrupoProgress {
  nome: string
  index: number
  status: "aguardando" | "buscando" | "ok" | "erro"
  membros?: number
  tagsAplicadas?: number
}

// ── Context type ────────────────────────────────────────────────────────────

interface VarreduraState {
  isRunning: boolean
  campanhaId: string | null
  campanhaNome: string | null
  progress: VarreduraProgressEvent[]
  grupoStatuses: GrupoProgress[]
  grupoTotal: number
  gruposConcluidos: number
  totalMembros: number
  totalTags: number
  totalErros: number
  totalLeads: number
  totalJaProcessados: number
  resultado: VarreduraResult | null
  error: string | null
  collapsed: boolean
  startVarredura: (campanhaId: string, campanhaNome: string, accessToken: string) => void
  dismiss: () => void
  toggleCollapsed: () => void
}

const VarreduraContext = createContext<VarreduraState | null>(null)

export function VarreduraProvider({ children }: { children: React.ReactNode }) {
  const [isRunning, setIsRunning] = useState(false)
  const [campanhaId, setCampanhaId] = useState<string | null>(null)
  const [campanhaNome, setCampanhaNome] = useState<string | null>(null)
  const [progress, setProgress] = useState<VarreduraProgressEvent[]>([])
  const [grupoStatuses, setGrupoStatuses] = useState<GrupoProgress[]>([])
  const [grupoTotal, setGrupoTotal] = useState(0)
  const [gruposConcluidos, setGruposConcluidos] = useState(0)
  const [totalMembros, setTotalMembros] = useState(0)
  const [totalTags, setTotalTags] = useState(0)
  const [totalErros, setTotalErros] = useState(0)
  const [totalLeads, setTotalLeads] = useState(0)
  const [totalJaProcessados, setTotalJaProcessados] = useState(0)
  const [resultado, setResultado] = useState<VarreduraResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)

  const dismiss = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsRunning(false)
    setCampanhaId(null)
    setCampanhaNome(null)
    setProgress([])
    setGrupoStatuses([])
    setGrupoTotal(0)
    setGruposConcluidos(0)
    setTotalMembros(0)
    setTotalTags(0)
    setTotalErros(0)
    setTotalLeads(0)
    setTotalJaProcessados(0)
    setResultado(null)
    setError(null)
    setCollapsed(false)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [])

  const startVarredura = useCallback(
    (cId: string, cNome: string, accessToken: string) => {
      // Don't start if already running
      if (isRunning) return

      // Reset state
      setIsRunning(true)
      setCampanhaId(cId)
      setCampanhaNome(cNome)
      setProgress([])
      setGrupoStatuses([])
      setGrupoTotal(0)
      setGruposConcluidos(0)
      setTotalMembros(0)
      setTotalTags(0)
      setTotalErros(0)
      setTotalLeads(0)
      setTotalJaProcessados(0)
      setResultado(null)
      setError(null)
      setCollapsed(false)

      // Track membros per group for building totals
      const membrosPerGrupo = new Map<number, number>()

      // Connect to SSE
      const url = `/api/admin/campanhas/${cId}/varredura-grupos/stream?token=${encodeURIComponent(accessToken)}`
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.addEventListener("progress", (e) => {
        try {
          const evt: VarreduraProgressEvent = JSON.parse(e.data)
          setProgress((prev) => [...prev, evt])

          if (evt.fase === "inicio" && evt.grupoTotal) {
            setGrupoTotal(evt.grupoTotal)
          }

          if (evt.fase === "metadata") {
            const idx = (evt.grupoIndex ?? 1) - 1
            const nome = evt.grupoNome ?? `Grupo ${idx + 1}`

            if (evt.status === "aguardando") {
              // Initialize grupo status
              setGrupoStatuses((prev) => {
                const next = [...prev]
                if (!next[idx]) {
                  next[idx] = { nome, index: idx, status: "aguardando" }
                }
                return next
              })
            } else if (evt.status === "buscando") {
              setGrupoStatuses((prev) => {
                const next = [...prev]
                next[idx] = { ...next[idx], nome, index: idx, status: "buscando" }
                return next
              })
            } else if (evt.status === "ok") {
              const membros = evt.membros ?? 0
              membrosPerGrupo.set(idx, membros)
              setGrupoStatuses((prev) => {
                const next = [...prev]
                next[idx] = { nome, index: idx, status: "ok", membros }
                return next
              })
              setGruposConcluidos((prev) => prev + 1)

              // Recalculate total membros
              let sum = 0
              membrosPerGrupo.forEach((v) => { sum += v })
              setTotalMembros(sum)
            } else if (evt.status === "erro") {
              setGrupoStatuses((prev) => {
                const next = [...prev]
                next[idx] = { nome, index: idx, status: "erro" }
                return next
              })
              setGruposConcluidos((prev) => prev + 1)
              setTotalErros(evt.erros ?? 0)
            }

            if (evt.grupoTotal) setGrupoTotal(evt.grupoTotal)
          }

          if (evt.fase === "tags") {
            setTotalTags(evt.tagsAplicadas ?? 0)
            setTotalLeads(evt.leadsEncontrados ?? 0)
            setTotalJaProcessados(evt.jaProcessados ?? 0)
            if (evt.erros !== undefined) setTotalErros(evt.erros)
          }

          if (evt.fase === "completo") {
            setTotalTags(evt.tagsAplicadas ?? 0)
            setTotalLeads(evt.leadsEncontrados ?? 0)
            setTotalJaProcessados(evt.jaProcessados ?? 0)
            setTotalMembros(evt.membros ?? 0)
            if (evt.erros !== undefined) setTotalErros(evt.erros)
          }
        } catch {
          // Ignore parse errors
        }
      })

      es.addEventListener("complete", (e) => {
        try {
          const data = JSON.parse(e.data)
          setResultado(data.resultado)
          setIsRunning(false)
          setCollapsed(true) // Auto-collapse on completion
        } catch {
          setIsRunning(false)
        }
        es.close()
        eventSourceRef.current = null
      })

      es.addEventListener("error", (e) => {
        // Check if it's an SSE error event with data
        if (e instanceof MessageEvent && e.data) {
          try {
            const data = JSON.parse(e.data)
            setError(data.message ?? "Erro desconhecido")
          } catch {
            setError("Erro de conexao com o servidor")
          }
        } else {
          // Connection error (e.g. server restart)
          setError("Conexao perdida com o servidor")
        }
        setIsRunning(false)
        es.close()
        eventSourceRef.current = null
      })
    },
    [isRunning],
  )

  return (
    <VarreduraContext.Provider
      value={{
        isRunning,
        campanhaId,
        campanhaNome,
        progress,
        grupoStatuses,
        grupoTotal,
        gruposConcluidos,
        totalMembros,
        totalTags,
        totalErros,
        totalLeads,
        totalJaProcessados,
        resultado,
        error,
        collapsed,
        startVarredura,
        dismiss,
        toggleCollapsed,
      }}
    >
      {children}
    </VarreduraContext.Provider>
  )
}

export function useVarredura() {
  const context = useContext(VarreduraContext)
  if (!context) throw new Error("useVarredura must be used within VarreduraProvider")
  return context
}
