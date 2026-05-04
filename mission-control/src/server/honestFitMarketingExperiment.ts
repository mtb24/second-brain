import type { PoolClient } from 'pg'
import { z } from 'zod'
import {
  defaultHonestFitMarketingExperiment,
  markHonestFitMarketingExperimentPostedSchema,
  marketingExperimentActionSchema,
  saveHonestFitMarketingLearningSchema,
  updateHonestFitMarketingExperimentSchema,
  type HonestFitMarketingExperiment,
  type HonestFitMarketingExperimentStatus,
  type MarketingExperimentAction,
} from '@/lib/honestFitMarketingExperiment'
import { getWorkoutPool, withWorkoutTransaction } from './workout/db'

type ExperimentRow = {
  id: string
  title: string
  hypothesis: string
  channel: string
  target_url: string
  post_draft: string
  status: HonestFitMarketingExperimentStatus
  post_url: string | null
  posted_at: Date | string | null
  check_after_hours: number
  learning_what_happened: string | null
  learning_what_was_confusing: string | null
  next_message_angle: string | null
  created_at: Date | string
  updated_at: Date | string
}

type Queryable = Pick<PoolClient, 'query'>

export async function getCurrentHonestFitMarketingExperiment(
  client: Queryable = getWorkoutPool(),
): Promise<HonestFitMarketingExperiment> {
  await ensureDefaultExperiment(client)
  const { rows } = await client.query<ExperimentRow>(
    `SELECT *
     FROM honestfit_marketing_experiments
     ORDER BY updated_at DESC
     LIMIT 1`,
  )
  return mapExperimentRow(rows[0])
}

export async function updateHonestFitMarketingExperiment(
  patch: z.infer<typeof updateHonestFitMarketingExperimentSchema>,
): Promise<HonestFitMarketingExperiment> {
  const validated = updateHonestFitMarketingExperimentSchema.parse(patch)
  return withWorkoutTransaction(async (client) => {
    const current = await getCurrentHonestFitMarketingExperiment(client)
    const next = { ...current, ...validated }
    return writeExperiment(client, next)
  })
}

export async function markHonestFitMarketingExperimentPosted(
  input: z.infer<typeof markHonestFitMarketingExperimentPostedSchema>,
): Promise<HonestFitMarketingExperiment> {
  const validated = markHonestFitMarketingExperimentPostedSchema.parse(input)
  return withWorkoutTransaction(async (client) => {
    const current = await getCurrentHonestFitMarketingExperiment(client)
    return writeExperiment(client, {
      ...current,
      status: 'waiting_for_data',
      postUrl: validated.postUrl,
      postedAt: validated.postedAt ?? new Date().toISOString(),
    })
  })
}

export async function saveHonestFitMarketingLearning(
  input: z.infer<typeof saveHonestFitMarketingLearningSchema>,
): Promise<HonestFitMarketingExperiment> {
  const validated = saveHonestFitMarketingLearningSchema.parse(input)
  return withWorkoutTransaction(async (client) => {
    const current = await getCurrentHonestFitMarketingExperiment(client)
    return writeExperiment(client, {
      ...current,
      ...validated,
      status: 'learning_captured',
    })
  })
}

export async function resetHonestFitMarketingExperiment(): Promise<HonestFitMarketingExperiment> {
  return withWorkoutTransaction(async (client) => {
    await client.query(
      `DELETE FROM honestfit_marketing_experiments
       WHERE id = $1`,
      [defaultHonestFitMarketingExperiment.id],
    )
    await ensureDefaultExperiment(client)
    return getCurrentHonestFitMarketingExperiment(client)
  })
}

export async function applyHonestFitMarketingExperimentAction(
  action: MarketingExperimentAction,
): Promise<HonestFitMarketingExperiment> {
  if (action.action === 'update') {
    return updateHonestFitMarketingExperiment(action.experiment)
  }
  if (action.action === 'mark_posted') {
    return markHonestFitMarketingExperimentPosted({
      postUrl: action.postUrl,
      postedAt: action.postedAt,
    })
  }
  if (action.action === 'save_learning') {
    return saveHonestFitMarketingLearning({
      learningWhatHappened: action.learningWhatHappened,
      learningWhatWasConfusing: action.learningWhatWasConfusing,
      nextMessageAngle: action.nextMessageAngle,
    })
  }
  return resetHonestFitMarketingExperiment()
}

async function ensureDefaultExperiment(client: Queryable) {
  await client.query(
    `INSERT INTO honestfit_marketing_experiments (
       id,
       title,
       hypothesis,
       channel,
       target_url,
       post_draft,
       check_after_hours
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      defaultHonestFitMarketingExperiment.id,
      defaultHonestFitMarketingExperiment.title,
      defaultHonestFitMarketingExperiment.hypothesis,
      defaultHonestFitMarketingExperiment.channel,
      defaultHonestFitMarketingExperiment.targetUrl,
      defaultHonestFitMarketingExperiment.postDraft,
      defaultHonestFitMarketingExperiment.checkAfterHours,
    ],
  )
}

async function writeExperiment(
  client: Queryable,
  experiment: HonestFitMarketingExperiment,
): Promise<HonestFitMarketingExperiment> {
  const { rows } = await client.query<ExperimentRow>(
    `UPDATE honestfit_marketing_experiments
     SET title = $2,
         hypothesis = $3,
         channel = $4,
         target_url = $5,
         post_draft = $6,
         status = $7,
         post_url = $8,
         posted_at = $9,
         check_after_hours = $10,
         learning_what_happened = $11,
         learning_what_was_confusing = $12,
         next_message_angle = $13,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      experiment.id,
      experiment.title,
      experiment.hypothesis,
      experiment.channel,
      experiment.targetUrl,
      experiment.postDraft,
      experiment.status,
      experiment.postUrl,
      experiment.postedAt,
      experiment.checkAfterHours,
      experiment.learningWhatHappened,
      experiment.learningWhatWasConfusing,
      experiment.nextMessageAngle,
    ],
  )
  return mapExperimentRow(rows[0])
}

function mapExperimentRow(row: ExperimentRow | undefined): HonestFitMarketingExperiment {
  if (!row) {
    throw new Error('HonestFit marketing experiment was not found')
  }

  return {
    id: row.id,
    title: row.title,
    hypothesis: row.hypothesis,
    channel: row.channel,
    targetUrl: row.target_url,
    postDraft: row.post_draft,
    status: row.status,
    postUrl: row.post_url,
    postedAt: isoFrom(row.posted_at),
    checkAfterHours: Number(row.check_after_hours),
    learningWhatHappened: row.learning_what_happened ?? '',
    learningWhatWasConfusing: row.learning_what_was_confusing ?? '',
    nextMessageAngle: row.next_message_angle ?? '',
    createdAt: isoFrom(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: isoFrom(row.updated_at) ?? new Date(0).toISOString(),
  }
}

function isoFrom(value: Date | string | null): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
