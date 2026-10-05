import { createHash, randomUUID } from "node:crypto"
export const stableId = (prefix: string, ...parts: unknown[]) => `${prefix}_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 20)}`
export const newId = (prefix: string) => `${prefix}_${randomUUID()}`
export const contentHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value, Object.keys(value as object).sort())).digest("hex")
