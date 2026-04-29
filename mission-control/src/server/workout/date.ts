export function dateInTimeZone(timezone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export function addDays(yyyyMmDd: string, days: number) {
  const date = new Date(`${yyyyMmDd}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function dayKey(yyyyMmDd: string) {
  const date = new Date(`${yyyyMmDd}T12:00:00Z`)
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getUTCDay()]
}

export function rangeStart(range: 'week' | 'month' | 'quarter', today: string) {
  if (range === 'week') return addDays(today, -7)
  if (range === 'quarter') return addDays(today, -91)
  return addDays(today, -31)
}
