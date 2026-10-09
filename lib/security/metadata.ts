/** Strip credential-bearing metadata without mutating canonical records. */
export const SENSITIVE_KEY = /(token|secret|password|cookie|authorization|api[_-]?key|openai[_-]?api|login[_-]?key|access[_-]?key|oauth|credential)/i
export function redactMetadata<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => redactMetadata(item)) as T
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE_KEY.test(key)).map(([key, item]) => [key, redactMetadata(item)])) as T
  return value
}
