const CT = 'America/Chicago'

export function isSameDayCT(kickoffUtc: string, now: Date = new Date()): boolean {
  const opts: Intl.DateTimeFormatOptions = { timeZone: CT }
  const fmt = (d: Date) => d.toLocaleDateString('en-US', opts)
  return fmt(new Date(kickoffUtc)) === fmt(now)
}
