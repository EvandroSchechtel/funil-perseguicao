"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Bot, Send, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Wrench, Sparkles, RotateCcw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { cn } from "@/lib/utils"

// ── Tipos ────────────────────────────────────────────────────────────────────

type StepThinking = { id: string; type: "thinking"; content: string }
type StepToolCall = {
  id: string
  type: "tool"
  tool: string
  args: unknown
  result?: { ok: boolean; data?: unknown; error?: string }
  expanded: boolean
}
type StepResponse = { id: string; type: "response"; content: string }
type StepError    = { id: string; type: "error"; message: string }
type Step = StepThinking | StepToolCall | StepResponse | StepError

interface Conversation {
  id: string
  prompt: string
  steps: Step[]
  status: "running" | "done" | "error"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function parseSSEChunk(chunk: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = []
  const lines = chunk.split("\n")
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        events.push(JSON.parse(line.slice(6)))
      } catch {}
    }
  }
  return events
}

function formatToolName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ThinkingStep({ step }: { step: StepThinking }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0 mt-0.5">
        <Loader2 className="w-3.5 h-3.5 text-[#25D366] animate-spin" />
      </div>
      <p className="text-[#8B8B9E] text-sm italic leading-relaxed">{step.content}</p>
    </div>
  )
}

function ToolStep({
  step,
  onToggle,
}: {
  step: StepToolCall
  onToggle: (id: string) => void
}) {
  const hasResult = step.result !== undefined
  const isOk = step.result?.ok === true

  return (
    <div className="border border-[#1E1E2A] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => onToggle(step.id)}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#16161E] hover:bg-[#1C1C28] transition-colors text-left"
      >
        <Wrench className="w-3.5 h-3.5 text-[#8B8B9E] shrink-0" />
        <span className="text-[#C4C4D4] text-sm font-medium flex-1">{formatToolName(step.tool)}</span>

        {!hasResult && (
          <Loader2 className="w-3.5 h-3.5 text-[#25D366] animate-spin shrink-0" />
        )}
        {hasResult && isOk && (
          <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
        )}
        {hasResult && !isOk && (
          <XCircle className="w-3.5 h-3.5 text-[#F87171] shrink-0" />
        )}

        {step.expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-[#5A5A72] shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-[#5A5A72] shrink-0" />
        }
      </button>

      {/* Body expandido */}
      {step.expanded && (
        <div className="border-t border-[#1E1E2A] bg-[#0F0F16]">
          {/* Args */}
          <div className="px-3 py-2 border-b border-[#1E1E2A]">
            <p className="text-[#5A5A72] text-xs font-medium uppercase tracking-wider mb-1.5">Argumentos</p>
            <pre className="text-[#C4C4D4] text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">
              {formatJson(step.args)}
            </pre>
          </div>

          {/* Result */}
          {hasResult && (
            <div className="px-3 py-2">
              <p className="text-[#5A5A72] text-xs font-medium uppercase tracking-wider mb-1.5">Resultado</p>
              {step.result!.ok ? (
                <pre className="text-[#25D366] text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {formatJson(step.result!.data)}
                </pre>
              ) : (
                <p className="text-[#F87171] text-xs font-mono">{step.result!.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResponseStep({ step }: { step: StepResponse }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-black" />
      </div>
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl rounded-tl-sm px-4 py-3 max-w-full">
        <p className="text-[#F1F1F3] text-sm leading-relaxed whitespace-pre-wrap">{step.content}</p>
      </div>
    </div>
  )
}

function ErrorStep({ step }: { step: StepError }) {
  return (
    <div className="flex items-start gap-3">
      <XCircle className="w-5 h-5 text-[#F87171] shrink-0 mt-0.5" />
      <p className="text-[#F87171] text-sm">{step.message}</p>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AgentePage() {
  const { accessToken } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [prompt, setPrompt] = useState("")
  const [running, setRunning] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversations])

  const toggleTool = useCallback((convId: string, stepId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== convId
          ? c
          : {
              ...c,
              steps: c.steps.map((s) =>
                s.id === stepId && s.type === "tool"
                  ? { ...s, expanded: !s.expanded }
                  : s
              ),
            }
      )
    )
  }, [])

  const handleSubmit = useCallback(async () => {
    const text = prompt.trim()
    if (!text || running || !accessToken) return

    setPrompt("")
    setRunning(true)

    const convId = uid()
    const conv: Conversation = { id: convId, prompt: text, steps: [], status: "running" }
    setConversations((prev) => [...prev, conv])

    const addStep = (step: Step) =>
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, steps: [...c.steps, step] } : c))
      )

    const updateLastTool = (result: StepToolCall["result"]) =>
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c
          const steps = [...c.steps]
          for (let i = steps.length - 1; i >= 0; i--) {
            const step = steps[i]
            if (step.type === "tool" && !step.result) {
              steps[i] = { ...step, result }
              break
            }
          }
          return { ...c, steps }
        })
      )

    const setStatus = (status: Conversation["status"]) =>
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, status } : c))
      )

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ prompt: text }),
      })

      if (!res.ok || !res.body) {
        addStep({ id: uid(), type: "error", message: "Erro ao conectar com o agente." })
        setStatus("error")
        setRunning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const events = parseSSEChunk(decoder.decode(value))

        for (const event of events) {
          switch (event.type) {
            case "thinking":
              addStep({ id: uid(), type: "thinking", content: event.content as string })
              break

            case "tool_call":
              addStep({
                id: uid(),
                type: "tool",
                tool: event.tool as string,
                args: event.args,
                expanded: false,
              })
              break

            case "tool_result":
              updateLastTool({
                ok: event.ok as boolean,
                data: event.data,
                error: event.error as string | undefined,
              })
              break

            case "response":
              addStep({ id: uid(), type: "response", content: event.content as string })
              break

            case "done":
              setStatus("done")
              break

            case "error":
              addStep({ id: uid(), type: "error", message: event.message as string })
              setStatus("error")
              break
          }
        }
      }
    } catch {
      addStep({ id: uid(), type: "error", message: "Erro de conexão." })
      setStatus("error")
    } finally {
      setRunning(false)
    }
  }, [prompt, running, accessToken])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleNewConversation = () => {
    setConversations([])
    setPrompt("")
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-screen">
      <Header
        breadcrumbs={[{ label: "Agente IA" }]}
        actions={
          conversations.length > 0 && (
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-2 text-[#8B8B9E] hover:text-[#F1F1F3] text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Nova conversa
            </button>
          )
        }
      />

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
            <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-[#25D366]" />
            </div>
            <div className="text-center">
              <h2 className="text-[#F1F1F3] text-xl font-semibold">Agente Funil Perseguição</h2>
              <p className="text-[#8B8B9E] text-sm mt-2 max-w-md">
                Descreva o que você precisa e o agente executará as ações necessárias no sistema.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 w-full max-w-xl">
              {[
                "Quantos leads falharam essa semana?",
                "Reprocesse todos os leads com falha",
                "Liste os webhooks ativos",
                "Mostre as métricas do dashboard",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setPrompt(suggestion); textareaRef.current?.focus() }}
                  className="text-left text-sm text-[#8B8B9E] border border-[#1E1E2A] rounded-lg px-4 py-3 hover:border-[#25D366]/40 hover:text-[#F1F1F3] hover:bg-[#16161E] transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            {conversations.map((conv) => (
              <div key={conv.id} className="space-y-4">
                {/* Prompt do usuário */}
                <div className="flex justify-end">
                  <div className="bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl rounded-tr-sm px-4 py-3 max-w-lg">
                    <p className="text-[#F1F1F3] text-sm leading-relaxed">{conv.prompt}</p>
                  </div>
                </div>

                {/* Steps de execução */}
                <div className="space-y-3 pl-2">
                  {conv.steps.map((step) => {
                    if (step.type === "thinking") return <ThinkingStep key={step.id} step={step} />
                    if (step.type === "tool") return (
                      <ToolStep key={step.id} step={step} onToggle={(sid) => toggleTool(conv.id, sid)} />
                    )
                    if (step.type === "response") return <ResponseStep key={step.id} step={step} />
                    if (step.type === "error") return <ErrorStep key={step.id} step={step} />
                    return null
                  })}

                  {/* Pulsando enquanto roda */}
                  {conv.status === "running" && conv.steps.length === 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                        <Loader2 className="w-3.5 h-3.5 text-[#25D366] animate-spin" />
                      </div>
                      <p className="text-[#8B8B9E] text-sm italic">Iniciando...</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[#1E1E2A] bg-[#0B0B0F] px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-[#16161E] border border-[#1E1E2A] rounded-xl px-4 py-3 focus-within:border-[#25D366]/50 transition-colors">
            <textarea
              ref={textareaRef}
              rows={1}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value)
                // Auto-resize
                e.target.style.height = "auto"
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"
              }}
              onKeyDown={handleKeyDown}
              placeholder="Descreva o que você quer fazer... (Enter para enviar)"
              disabled={running}
              className="flex-1 bg-transparent text-[#F1F1F3] text-sm placeholder-[#5A5A72] resize-none outline-none leading-relaxed disabled:opacity-50"
              style={{ minHeight: "24px", maxHeight: "160px" }}
            />
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || running}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all",
                prompt.trim() && !running
                  ? "bg-[#25D366] hover:bg-[#1EBD5A] text-black"
                  : "bg-[#1E1E2A] text-[#3A3A4A] cursor-not-allowed"
              )}
            >
              {running
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
          <p className="text-[#3A3A4A] text-xs mt-2 text-center">
            O agente pode executar ações reais no sistema. Revise antes de confirmar ações destrutivas.
          </p>
        </div>
      </div>
    </div>
  )
}
