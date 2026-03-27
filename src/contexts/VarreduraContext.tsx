"use client"

import React, { createContext, useContext, useState, useCallback, useRef } from "react"
import type { VarreduraResult } from "@/lib/services/varredura-grupos.service"

// ── Context type ────────────────────────────────────────────────────────────

interface VarreduraState {
  isRunning: boolean
  campanhaId: string | null
  campanhaNome: string | null
  resultado: VarreduraResult | null
  error: string | null
  startVarredura: (campanhaId: string, campanhaNome: string, accessToken: string) => void
  dismiss: () => void
}

const VarreduraContext = createContext<VarreduraState | null>(null)

export function VarreduraProvider({ children }: { children: React.ReactNode }) {
  const [isRunning, setIsRunning] = useState(false)
  const [campanhaId, setCampanhaId] = useState<string | null>(null)
  const [campanhaNome, setCampanhaNome] = useState<string | null>(null)
  const [resultado, setResultado] = useState<VarreduraResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const dismiss = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsRunning(false)
    setCampanhaId(null)
    setCampanhaNome(null)
    setResultado(null)
    setError(null)
  }, [])

  const startVarredura = useCallback(
    (cId: string, cNome: string, accessToken: string) => {
      // Don't start if already running
      if (isRunning) return

      // Reset state
      setIsRunning(true)
      setCampanhaId(cId)
      setCampanhaNome(cNome)
      setResultado(null)
      setError(null)

      const controller = new AbortController()
      abortRef.current = controller

      fetch(`/api/admin/campanhas/${cId}/varredura-grupos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => null)
            throw new Error(body?.error ?? `Erro ${res.status}`)
          }
          return res.json()
        })
        .then((data) => {
          setResultado(data.resultado)
          setIsRunning(false)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return
          setError(err instanceof Error ? err.message : "Erro desconhecido")
          setIsRunning(false)
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
        resultado,
        error,
        startVarredura,
        dismiss,
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
