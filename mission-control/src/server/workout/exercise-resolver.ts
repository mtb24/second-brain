import type { Exercise } from './types'

export type ExerciseResolverMatch = {
  exercise: Exercise
  confidence: number
  matchedName: string
  reason: 'exact' | 'alias' | 'contains' | 'fuzzy'
}

export type ExerciseResolution = {
  status: 'matched' | 'ambiguous' | 'unmatched'
  query: string
  normalizedQuery: string
  matches: ExerciseResolverMatch[]
}

const minConfidence = 0.52
const ambiguityDelta = 0.08

const phraseReplacements: Array<[RegExp, string]> = [
  [/\bhammer\s*smith\b/g, 'hammer strength'],
  [/\bhammerstrength\b/g, 'hammer strength'],
  [/\bhammersmith\b/g, 'hammer strength'],
  [/\bhs\b/g, 'hammer strength'],
  [/\bplate\s*loaded\b/g, 'plate loaded'],
]

export function resolveExerciseName(
  query: string,
  exercises: Exercise[],
): ExerciseResolution {
  const normalizedQuery = normalizeExerciseName(query)
  if (!normalizedQuery) {
    return { status: 'unmatched', query, normalizedQuery, matches: [] }
  }

  const matches = exercises
    .map((exercise) => bestMatchForExercise(normalizedQuery, exercise))
    .filter((match): match is ExerciseResolverMatch => Boolean(match))
    .sort((a, b) => b.confidence - a.confidence)

  const strongMatches = matches.filter((match) => match.confidence >= minConfidence)
  if (!strongMatches.length) {
    return { status: 'unmatched', query, normalizedQuery, matches: matches.slice(0, 5) }
  }

  const [first, second] = strongMatches
  const queryTokenCount = normalizedQuery.split(' ').filter(Boolean).length
  const genericShortQuery = queryTokenCount <= 2 && first.confidence < 1 && second?.confidence >= 0.72
  if (second && (genericShortQuery || (first.confidence < 0.98 && first.confidence - second.confidence <= ambiguityDelta))) {
    return { status: 'ambiguous', query, normalizedQuery, matches: strongMatches.slice(0, 5) }
  }

  return { status: 'matched', query, normalizedQuery, matches: strongMatches.slice(0, 5) }
}

export function normalizeExerciseName(value: string) {
  let normalized = value.toLowerCase()
  for (const [pattern, replacement] of phraseReplacements) {
    normalized = normalized.replace(pattern, replacement)
  }
  return normalized
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bmachine\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function bestMatchForExercise(
  normalizedQuery: string,
  exercise: Exercise,
): ExerciseResolverMatch | null {
  const candidates = [exercise.canonicalName, ...exercise.aliases]
  let best: ExerciseResolverMatch | null = null

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeExerciseName(candidate)
    const reason = candidate === exercise.canonicalName ? 'exact' : 'alias'
    const confidence = scoreCandidate(normalizedQuery, normalizedCandidate, reason)
    if (confidence <= 0) continue

    const match: ExerciseResolverMatch = {
      exercise,
      confidence,
      matchedName: candidate,
      reason: confidence >= 0.99 ? reason : normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate) ? 'contains' : 'fuzzy',
    }
    if (!best || match.confidence > best.confidence) best = match
  }

  return best
}

function scoreCandidate(
  normalizedQuery: string,
  normalizedCandidate: string,
  exactReason: 'exact' | 'alias',
) {
  if (!normalizedCandidate) return 0
  if (normalizedCandidate === normalizedQuery) return exactReason === 'exact' ? 1 : 0.99

  if (normalizedCandidate.includes(normalizedQuery)) {
    const ratio = normalizedQuery.length / normalizedCandidate.length
    return Math.max(0.82, Math.min(0.96, 0.76 + ratio * 0.2))
  }

  if (normalizedQuery.includes(normalizedCandidate)) {
    const ratio = normalizedCandidate.length / normalizedQuery.length
    return Math.max(0.72, Math.min(0.91, 0.68 + ratio * 0.2))
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const candidateTokens = normalizedCandidate.split(' ').filter(Boolean)
  if (!queryTokens.length || !candidateTokens.length) return 0

  const matchedQueryTokens = queryTokens.filter((queryToken) =>
    candidateTokens.some((candidateToken) => tokenMatches(queryToken, candidateToken)),
  )
  const matchedCandidateTokens = candidateTokens.filter((candidateToken) =>
    queryTokens.some((queryToken) => tokenMatches(queryToken, candidateToken)),
  )
  const queryCoverage = matchedQueryTokens.length / queryTokens.length
  const candidateCoverage = matchedCandidateTokens.length / candidateTokens.length
  const shared = new Set(matchedQueryTokens).size
  const union = new Set([...queryTokens, ...candidateTokens]).size
  const jaccard = union > 0 ? shared / union : 0

  return queryCoverage * 0.55 + candidateCoverage * 0.3 + jaccard * 0.15
}

function tokenMatches(left: string, right: string) {
  if (left === right) return true
  if (left.length >= 4 && right.length >= 4 && (left.startsWith(right) || right.startsWith(left))) return true
  return levenshteinDistance(left, right) <= (Math.max(left.length, right.length) >= 7 ? 2 : 1)
}

function levenshteinDistance(left: string, right: string) {
  const rows = left.length + 1
  const columns = right.length + 1
  const distances = Array.from({ length: rows }, () => Array<number>(columns).fill(0))

  for (let row = 0; row < rows; row += 1) distances[row][0] = row
  for (let column = 0; column < columns; column += 1) distances[0][column] = column

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost,
      )
    }
  }

  return distances[left.length][right.length]
}
