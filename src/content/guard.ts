export function claimOnce(name: string): boolean {
  const scope = globalThis as unknown as Record<string, unknown>;
  const key = `__anilistTracker_${name}`;
  if (scope[key]) return false;
  scope[key] = true;
  return true;
}
