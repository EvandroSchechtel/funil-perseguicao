/**
 * SSE (Server-Sent Events) helpers for the agent chat endpoint.
 * Defines the event types streamed to the client.
 */

export type SSEEventType =
  | "thinking"    // Claude está processando / raciocínio intermediário
  | "tool_call"   // Claude decidiu chamar uma ferramenta
  | "tool_result" // Resultado da execução da ferramenta
  | "response"    // Texto final da resposta do agente
  | "done"        // Execução concluída
  | "error"       // Erro fatal

export interface SSEEvent {
  type: SSEEventType
  [key: string]: unknown
}

/** Serializa um evento SSE no formato padrão */
export function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/** Headers padrão para resposta SSE */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no", // desativa buffer do nginx
}
