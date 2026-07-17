import { useQuery } from '@tanstack/react-query'
import type { HonestFitMissionSummaryResult } from '@/server/honestFitMissionSummary'

export async function fetchHonestFitMissionSummaryClient(): Promise<HonestFitMissionSummaryResult> {
  const response = await fetch('/api/honestfit/mission-summary', {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('Unable to load HonestFit status')
  return response.json()
}

export function useHonestFitMissionSummary() {
  return useQuery({
    queryKey: ['honestfit-mission-summary'],
    queryFn: fetchHonestFitMissionSummaryClient,
    refetchInterval: 60_000,
  })
}
