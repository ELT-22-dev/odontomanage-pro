/** Empty-string form fields become null so optional date/number columns don't reject "" as invalid. */
export function sanitize<T extends Record<string, unknown>>(data: T): T {
  const out = {} as T
  for (const [key, value] of Object.entries(data)) {
    ;(out as Record<string, unknown>)[key] = value === '' ? null : value
  }
  return out
}
