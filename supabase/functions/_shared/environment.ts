export function getProjectKey(keysName: string, singleName: string, legacyName: string): string | null {
  const keys = Deno.env.get(keysName);
  if (keys) {
    try {
      const value: unknown = JSON.parse(keys);
      if (typeof value === 'object' && value !== null && 'default' in value && typeof value.default === 'string' && value.default) return value.default;
    } catch { /* Support the older single-key environment during rotation. */ }
  }
  return Deno.env.get(singleName) ?? Deno.env.get(legacyName) ?? null;
}
