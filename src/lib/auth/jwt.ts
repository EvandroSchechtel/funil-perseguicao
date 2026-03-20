import { SignJWT, jwtVerify, type JWTPayload } from "jose"

export interface JwtPayload extends JWTPayload {
  id: string
  email: string
  role: string
  force_password_change: boolean
  cliente_id?: string | null
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET env var is not set")
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(payload: Omit<JwtPayload, keyof JWTPayload>): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN || "15m"
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as JwtPayload
  } catch {
    return null
  }
}
