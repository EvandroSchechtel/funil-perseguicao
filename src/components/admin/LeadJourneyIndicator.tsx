"use client"

import React from "react"
import {
  Inbox, ListChecks, Cog, CheckCircle2, XCircle,
  AlertTriangle, LogIn, Tag, Pause,
} from "lucide-react"

interface LeadJourneyProps {
  status: string
  createdAt: string | null
  processadoAt: string | null
  grupoEntrouAt: string | null
  grupoSaiuAt: string | null
  tagAplicada?: boolean
  tentativas: number
  pausado?: boolean
}

type StepState = "completed" | "active" | "failed" | "warning" | "pending"

const STATE_CLASSES: Record<StepState, string> = {
  completed: "bg-[#25D366]/15 text-[#25D366] border-[#25D366]/30",
  active:    "bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/30",
  failed:    "bg-[#F87171]/15 text-[#F87171] border-[#F87171]/30",
  warning:   "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  pending:   "bg-[#1C1C28] text-[#5A5A72] border-[#2A2A3A]",
}

const CONNECTOR_CLASSES: Record<StepState, string> = {
  completed: "text-[#25D366]/50",
  active:    "text-[#60A5FA]/50",
  failed:    "text-[#F87171]/50",
  warning:   "text-[#F59E0B]/50",
  pending:   "text-[#2A2A3A]",
}

interface StepDef {
  icon: React.ElementType
  label: string
  state: StepState
  sublabel?: string
}

function resolveSteps(props: LeadJourneyProps) {
  const { status, processadoAt, grupoEntrouAt, grupoSaiuAt, tagAplicada, tentativas, pausado } = props

  const isBeyondPendente = status !== "pendente" && status !== "aguardando"
  const isTerminal = ["sucesso", "falha", "sem_optin"].includes(status)

  // Step 1: Recebido
  const recebido: StepDef = {
    icon: Inbox,
    label: "Recebido",
    state: "completed",
  }

  // Step 2: Na Fila
  let naFilaState: StepState = "pending"
  let naFilaLabel = "Na Fila"
  if (pausado || status === "aguardando") {
    naFilaState = "warning"
    naFilaLabel = "Na Fila (pausada)"
  } else if (status === "pendente") {
    naFilaState = "active"
  } else if (isBeyondPendente) {
    naFilaState = "completed"
  }
  const naFila: StepDef = {
    icon: pausado || status === "aguardando" ? Pause : ListChecks,
    label: naFilaLabel,
    state: naFilaState,
  }

  // Step 3: Processado
  let processadoState: StepState = "pending"
  if (processadoAt) {
    processadoState = "completed"
  } else if (status === "processando") {
    processadoState = "active"
  }
  const processado: StepDef = {
    icon: Cog,
    label: "Processado",
    state: processadoState,
  }

  // Step 4: Resultado
  let resultadoState: StepState = "pending"
  let resultadoLabel = "Aguardando resultado"
  let resultadoIcon: React.ElementType = CheckCircle2
  let resultadoSublabel: string | undefined

  if (status === "sucesso") {
    resultadoState = "completed"
    resultadoLabel = "Flow Enviado"
    resultadoIcon = CheckCircle2
  } else if (status === "falha") {
    resultadoState = "failed"
    resultadoLabel = "Falha"
    resultadoIcon = XCircle
    resultadoSublabel = `${tentativas} tentativa${tentativas !== 1 ? "s" : ""}`
  } else if (status === "sem_optin") {
    resultadoState = "warning"
    resultadoLabel = "Sem Opt-in"
    resultadoIcon = AlertTriangle
  } else if (isTerminal) {
    resultadoState = "completed"
  }

  const resultado: StepDef = {
    icon: resultadoIcon,
    label: resultadoLabel,
    state: resultadoState,
    sublabel: resultadoSublabel,
  }

  // Step 5 (second row): Entrou Grupo
  const hasGrupoActivity = !!grupoEntrouAt
  let entrouGrupoState: StepState = "pending"
  let entrouGrupoSublabel: string | undefined
  if (grupoEntrouAt) {
    entrouGrupoState = "completed"
    if (grupoSaiuAt) {
      entrouGrupoSublabel = "Saiu do grupo"
    }
  }
  const entrouGrupo: StepDef = {
    icon: LogIn,
    label: "Entrou Grupo",
    state: entrouGrupoState,
    sublabel: entrouGrupoSublabel,
  }

  // Step 6 (second row): Tag Aplicada
  let tagState: StepState = "pending"
  if (tagAplicada) {
    tagState = "completed"
  } else if (grupoEntrouAt && !tagAplicada) {
    tagState = "warning"
  }
  const tagStep: StepDef = {
    icon: Tag,
    label: "Tag Aplicada",
    state: tagState,
  }

  return {
    mainRow: [recebido, naFila, processado, resultado],
    secondRow: hasGrupoActivity ? [entrouGrupo, tagStep] : null,
  }
}

function StepPill({ step }: { step: StepDef }) {
  const Icon = step.icon
  const isActive = step.state === "active"

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium
          whitespace-nowrap transition-all
          ${STATE_CLASSES[step.state]}
          ${isActive ? "animate-pulse" : ""}
        `}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{step.label}</span>
      </div>
      {step.sublabel && (
        <span className={`text-[10px] ${step.state === "failed" ? "text-[#F87171]/70" : step.state === "completed" && step.sublabel === "Saiu do grupo" ? "text-[#F87171]/70" : "text-[#5A5A72]"}`}>
          {step.sublabel}
        </span>
      )}
    </div>
  )
}

function HorizontalConnector({ state }: { state: StepState }) {
  return (
    <span className={`text-sm font-medium select-none shrink-0 ${CONNECTOR_CLASSES[state]}`}>
      &rarr;
    </span>
  )
}

export function LeadJourneyIndicator(props: LeadJourneyProps) {
  const { mainRow, secondRow } = resolveSteps(props)

  return (
    <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
      <h2 className="text-[#F1F1F3] font-semibold mb-1 text-sm">Jornada do Lead</h2>
      <p className="text-[#5A5A72] text-xs mb-4">Progresso no funil de perseguição</p>

      {/* Main row */}
      <div className="flex items-center gap-2 flex-wrap">
        {mainRow.map((step, i) => (
          <React.Fragment key={step.label}>
            <StepPill step={step} />
            {i < mainRow.length - 1 && (
              <HorizontalConnector state={mainRow[i + 1].state !== "pending" ? mainRow[i + 1].state : step.state} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Second row: grupo activity */}
      {secondRow && (
        <div className="mt-3 flex items-start">
          {/* Spacer to align under "Resultado" — approximate alignment */}
          <div className="hidden sm:block" style={{ minWidth: "calc(75% - 2rem)" }} />
          <div className="flex flex-col items-start gap-2 sm:items-center">
            {/* Vertical connector */}
            <span className={`text-sm font-medium select-none ${CONNECTOR_CLASSES[secondRow[0].state]}`}>
              &darr;
            </span>
            {/* Second row steps */}
            <div className="flex items-center gap-2 flex-wrap">
              {secondRow.map((step, i) => (
                <React.Fragment key={step.label}>
                  <StepPill step={step} />
                  {i < secondRow.length - 1 && (
                    <HorizontalConnector state={secondRow[i + 1].state !== "pending" ? secondRow[i + 1].state : step.state} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
