import { NextResponse } from "next/server"
import { ServiceError } from "@/lib/services/errors"

export function handleServiceError(err: unknown) {
  if (err instanceof ServiceError) {
    switch (err.code) {
      case "not_found": return notFound(err.message)
      case "bad_request": return badRequest(err.message)
      case "conflict": return conflict(err.message)
      case "forbidden": return forbidden(err.message)
    }
  }
  return null
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function badRequest(message: string, errors?: Record<string, string[]>) {
  return NextResponse.json({ error: "bad_request", message, ...(errors && { errors }) }, { status: 400 })
}

export function unauthorized(message = "Não autenticado", error = "unauthorized") {
  return NextResponse.json({ error, message }, { status: 401 })
}

export function forbidden(message = "Acesso negado", error = "forbidden") {
  return NextResponse.json({ error, message }, { status: 403 })
}

export function notFound(message = "Não encontrado") {
  return NextResponse.json({ error: "not_found", message }, { status: 404 })
}

export function conflict(message: string) {
  return NextResponse.json({ error: "conflict", message }, { status: 409 })
}

export function tooManyRequests(message: string) {
  return NextResponse.json({ error: "too_many_attempts", message }, { status: 429 })
}

export function serverError(message = "Erro interno do servidor") {
  return NextResponse.json({ error: "internal_error", message }, { status: 500 })
}
