// BullMQ bundles its own ioredis internally, which conflicts with the top-level ioredis package types.
// To avoid the TypeScript conflict, we export a plain connection config object that satisfies both.

export interface RedisConnectionConfig {
  host: string
  port: number
  password?: string
  username?: string
  tls?: object
  maxRetriesPerRequest: null
  enableReadyCheck: boolean
}

function parseRedisUrl(url: string): Omit<RedisConnectionConfig, "maxRetriesPerRequest" | "enableReadyCheck"> {
  try {
    const parsed = new URL(url)
    const isTls = parsed.protocol === "rediss:"
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || (isTls ? "6380" : "6379"), 10),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(parsed.username && parsed.username !== "default" ? { username: decodeURIComponent(parsed.username) } : {}),
      ...(isTls ? { tls: {} } : {}),
    }
  } catch {
    return { host: "localhost", port: 6379 }
  }
}

export function getRedisConfig(): RedisConnectionConfig {
  const url = process.env.REDIS_URL || "redis://localhost:6379"
  return {
    ...parseRedisUrl(url),
    maxRetriesPerRequest: null, // required for BullMQ
    enableReadyCheck: false,
  }
}
