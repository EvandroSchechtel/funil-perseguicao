export type ServiceErrorCode = "not_found" | "bad_request" | "conflict" | "forbidden"

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string
  ) {
    super(message)
    this.name = "ServiceError"
  }
}
