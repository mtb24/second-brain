import type { PoolClient } from 'pg'
import {
  defaultHonestFitMarketingExperiment,
  markHonestFitMarketingExperimentPostedSchema,
  marketingExperimentActionSchema,
  preparedHonestFitMarketingCampaignDrafts,
  saveHonestFitMarketingLearningSchema,
  updateHonestFitMarketingCampaignSchema,
  type HonestFitMarketingCampaign,
  type HonestFitMarketingCampaignState,
  type HonestFitMarketingCampaignStatus,
  type MarketingExperimentAction,
} from '@/lib/honestFitMarketingExperiment'
import { getWorkoutPool, withWorkoutTransaction } from './workout/db'

type CampaignRow = {
  id: string
  title: string
  hypothesis: string
  channel: string
  target_url: string
  post_draft: string | null
  post_body: string | null
  hook: string | null
  angle: string | null
  audience: string | null
  suggested_screenshot: string | null
  feedback_ask: string | null
  status: HonestFitMarketingCampaignStatus
  post_url: string | null
  posted_url: string | null
  posted_at: Date | string | null
  check_after_hours: number
  check_after: Date | string | null
  learning_what_happened: string | null
  learning_what_was_confusing: string | null
  next_message_angle: string | null
  created_at: Date | string
  updated_at: Date | string
}

type Queryable = Pick<PoolClient, 'query'>

export async function getCurrentHonestFitMarketingExperiment(
  client: Queryable = getWorkoutPool(),
): Promise<HonestFitMarketingCampaignState> {
  await ensureDefaultCampaigns(client)
  const { rows } = await client.query<CampaignRow>(
    `SELECT *
     FROM honestfit_marketing_experiments
     ORDER BY
       CASE status
         WHEN 'draft' THEN 0
         WHEN 'ready' THEN 1
         WHEN 'waiting_for_data' THEN 2
         WHEN 'posted' THEN 3
         WHEN 'learning_captured' THEN 4
         ELSE 5
       END,
       updated_at DESC`,
  )
  const campaigns = rows.map(mapCampaignRow)
  return {
    campaigns,
    selectedCampaignId: selectDefaultCampaign(campaigns),
  }
}

export async function updateHonestFitMarketingCampaign(
  campaignId: string,
  patch: unknown,
): Promise<HonestFitMarketingCampaignState> {
  const validated = updateHonestFitMarketingCampaignSchema.parse(patch)
  return withWorkoutTransaction(async (client) => {
    const campaign = await getCampaign(client, campaignId)
    await writeCampaign(client, { ...campaign, ...validated })
    return selectCampaignState(client, campaignId)
  })
}

export async function markHonestFitMarketingExperimentPosted(
  input: unknown,
): Promise<HonestFitMarketingCampaignState> {
  const validated = markHonestFitMarketingExperimentPostedSchema.parse(input)
  return withWorkoutTransaction(async (client) => {
    const campaign = await getCampaign(client, validated.campaignId)
    const postedAt = validated.postedAt ?? new Date().toISOString()
    const checkAfter = new Date(
      new Date(postedAt).getTime() + 24 * 60 * 60 * 1000,
    ).toISOString()
    await writeCampaign(client, {
      ...campaign,
      status: 'waiting_for_data',
      postedUrl: validated.postedUrl,
      postedAt,
      checkAfter,
    })
    return selectCampaignState(client, campaign.id)
  })
}

export async function saveHonestFitMarketingLearning(
  input: unknown,
): Promise<HonestFitMarketingCampaignState> {
  const validated = saveHonestFitMarketingLearningSchema.parse(input)
  return withWorkoutTransaction(async (client) => {
    const campaign = await getCampaign(client, validated.campaignId)
    await writeCampaign(client, {
      ...campaign,
      learningWhatHappened: validated.learningWhatHappened,
      learningWhatWasConfusing: validated.learningWhatWasConfusing,
      nextMessageAngle: validated.nextMessageAngle,
      status: 'learning_captured',
    })
    return selectCampaignState(client, campaign.id)
  })
}

export async function startNextHonestFitMarketingCampaign(
  draftId: string,
): Promise<HonestFitMarketingCampaignState> {
  return withWorkoutTransaction(async (client) => {
    const source = await getCampaign(client, draftId)
    const now = new Date().toISOString()
    const id = `${source.id}-${Date.now()}`
    const campaign = {
      ...source,
      id,
      status: 'draft' as const,
      postDraft: source.postBody,
      postedUrl: null,
      postUrl: null,
      postedAt: null,
      checkAfter: null,
      checkAfterHours: 24,
      learningWhatHappened: '',
      learningWhatWasConfusing: '',
      nextMessageAngle: '',
      createdAt: now,
      updatedAt: now,
    }
    await insertCampaign(client, campaign)
    return selectCampaignState(client, id)
  })
}

export async function applyHonestFitMarketingExperimentAction(
  action: MarketingExperimentAction,
): Promise<HonestFitMarketingCampaignState> {
  const parsed = marketingExperimentActionSchema.parse(action)
  if (parsed.action === 'update') {
    return updateHonestFitMarketingCampaign(parsed.campaignId, parsed.campaign)
  }
  if (parsed.action === 'mark_posted') {
    return markHonestFitMarketingExperimentPosted({
      campaignId: parsed.campaignId,
      postedUrl: parsed.postedUrl,
      postedAt: parsed.postedAt,
    })
  }
  if (parsed.action === 'save_learning') {
    return saveHonestFitMarketingLearning(parsed)
  }
  if (parsed.action === 'start_next_campaign') {
    return startNextHonestFitMarketingCampaign(parsed.draftId)
  }
  return updateHonestFitMarketingCampaign(parsed.campaignId, {
    status: 'archived',
  })
}

async function selectCampaignState(
  client: Queryable,
  selectedCampaignId: string,
): Promise<HonestFitMarketingCampaignState> {
  const state = await getCurrentHonestFitMarketingExperiment(client)
  return { ...state, selectedCampaignId }
}

async function ensureDefaultCampaigns(client: Queryable) {
  await ensureLegacyColumns(client)
  await insertCampaignIfMissing(client, {
    ...defaultHonestFitMarketingExperiment,
    postDraft: defaultHonestFitMarketingExperiment.postBody,
    postedUrl: null,
    postUrl: null,
    postedAt: null,
    checkAfter: null,
    checkAfterHours: 24,
    learningWhatHappened: '',
    learningWhatWasConfusing: '',
    nextMessageAngle: '',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  })
  for (const draft of preparedHonestFitMarketingCampaignDrafts) {
    await insertCampaignIfMissing(client, {
      ...draft,
      postDraft: draft.postBody,
      postedUrl: null,
      postUrl: null,
      postedAt: null,
      checkAfter: null,
      checkAfterHours: 24,
      learningWhatHappened: '',
      learningWhatWasConfusing: '',
      nextMessageAngle: '',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    })
  }
}

async function ensureLegacyColumns(client: Queryable) {
  await client.query(
    `ALTER TABLE honestfit_marketing_experiments
       DROP CONSTRAINT IF EXISTS honestfit_marketing_experiments_status_check`,
  )
  await client.query(
    `ALTER TABLE honestfit_marketing_experiments
       ADD COLUMN IF NOT EXISTS post_body text,
       ADD COLUMN IF NOT EXISTS hook text,
       ADD COLUMN IF NOT EXISTS angle text,
       ADD COLUMN IF NOT EXISTS audience text,
       ADD COLUMN IF NOT EXISTS posted_url text,
       ADD COLUMN IF NOT EXISTS check_after timestamptz,
       ADD COLUMN IF NOT EXISTS suggested_screenshot text,
       ADD COLUMN IF NOT EXISTS feedback_ask text`,
  )
  await client.query(
    `ALTER TABLE honestfit_marketing_experiments
       ADD CONSTRAINT honestfit_marketing_experiments_status_check
       CHECK (status IN (
         'draft',
         'ready',
         'posted',
         'waiting_for_data',
         'learning_captured',
         'archived'
       ))`,
  )
  await client.query(
    `UPDATE honestfit_marketing_experiments
     SET post_body = COALESCE(post_body, post_draft),
         posted_url = COALESCE(posted_url, post_url),
         check_after = COALESCE(
           check_after,
           posted_at + (check_after_hours || ' hours')::interval
         )
     WHERE post_body IS NULL
        OR posted_url IS NULL
        OR (check_after IS NULL AND posted_at IS NOT NULL)`,
  )
}

async function insertCampaignIfMissing(
  client: Queryable,
  campaign: HonestFitMarketingCampaign,
) {
  await client.query(
    `INSERT INTO honestfit_marketing_experiments (
       id,
       title,
       hypothesis,
       channel,
       target_url,
       post_draft,
       post_body,
       hook,
       angle,
       audience,
       suggested_screenshot,
       feedback_ask,
       status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING`,
    [
      campaign.id,
      campaign.title,
      campaign.hypothesis,
      campaign.channel,
      campaign.targetUrl,
      campaign.postBody,
      campaign.hook,
      campaign.angle,
      campaign.audience,
      campaign.suggestedScreenshot,
      campaign.feedbackAsk,
      campaign.status,
    ],
  )
}

async function insertCampaign(
  client: Queryable,
  campaign: HonestFitMarketingCampaign,
) {
  await client.query(
    `INSERT INTO honestfit_marketing_experiments (
       id,
       title,
       hypothesis,
       channel,
       target_url,
       post_draft,
       post_body,
       hook,
       angle,
       audience,
       suggested_screenshot,
       feedback_ask,
       status,
       post_url,
       posted_url,
       posted_at,
       check_after,
       learning_what_happened,
       learning_what_was_confusing,
       next_message_angle
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13, $13,
       $14, $15, $16, $17, $18
     )`,
    [
      campaign.id,
      campaign.title,
      campaign.hypothesis,
      campaign.channel,
      campaign.targetUrl,
      campaign.postBody,
      campaign.hook,
      campaign.angle,
      campaign.audience,
      campaign.suggestedScreenshot,
      campaign.feedbackAsk,
      campaign.status,
      campaign.postedUrl,
      campaign.postedAt,
      campaign.checkAfter,
      campaign.learningWhatHappened,
      campaign.learningWhatWasConfusing,
      campaign.nextMessageAngle,
    ],
  )
}

async function getCampaign(
  client: Queryable,
  campaignId?: string,
): Promise<HonestFitMarketingCampaign> {
  await ensureDefaultCampaigns(client)
  const id = campaignId ?? defaultHonestFitMarketingExperiment.id
  const { rows } = await client.query<CampaignRow>(
    `SELECT *
     FROM honestfit_marketing_experiments
     WHERE id = $1
     LIMIT 1`,
    [id],
  )
  return mapCampaignRow(rows[0])
}

async function writeCampaign(
  client: Queryable,
  campaign: HonestFitMarketingCampaign,
): Promise<HonestFitMarketingCampaign> {
  const { rows } = await client.query<CampaignRow>(
    `UPDATE honestfit_marketing_experiments
     SET title = $2,
         hypothesis = $3,
         channel = $4,
         target_url = $5,
         post_draft = $6,
         post_body = $6,
         hook = $7,
         angle = $8,
         audience = $9,
         suggested_screenshot = $10,
         feedback_ask = $11,
         status = $12,
         post_url = $13,
         posted_url = $13,
         posted_at = $14,
         check_after = $15,
         check_after_hours = 24,
         learning_what_happened = $16,
         learning_what_was_confusing = $17,
         next_message_angle = $18,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      campaign.id,
      campaign.title,
      campaign.hypothesis,
      campaign.channel,
      campaign.targetUrl,
      campaign.postBody,
      campaign.hook,
      campaign.angle,
      campaign.audience,
      campaign.suggestedScreenshot,
      campaign.feedbackAsk,
      campaign.status,
      campaign.postedUrl,
      campaign.postedAt,
      campaign.checkAfter,
      campaign.learningWhatHappened,
      campaign.learningWhatWasConfusing,
      campaign.nextMessageAngle,
    ],
  )
  return mapCampaignRow(rows[0])
}

function selectDefaultCampaign(campaigns: HonestFitMarketingCampaign[]) {
  return (
    campaigns.find((campaign) => campaign.status === 'draft')?.id ??
    campaigns.find((campaign) => campaign.status === 'ready')?.id ??
    campaigns.find((campaign) => campaign.status === 'waiting_for_data')?.id ??
    campaigns.find((campaign) => campaign.status === 'posted')?.id ??
    campaigns[0]?.id ??
    defaultHonestFitMarketingExperiment.id
  )
}

function mapCampaignRow(row: CampaignRow | undefined): HonestFitMarketingCampaign {
  if (!row) {
    throw new Error('HonestFit marketing campaign was not found')
  }

  const postedAt = isoFrom(row.posted_at)
  const checkAfter =
    isoFrom(row.check_after) ??
    (postedAt
      ? new Date(
          new Date(postedAt).getTime() +
            Number(row.check_after_hours) * 60 * 60 * 1000,
        ).toISOString()
      : null)

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    channel: row.channel,
    targetUrl: row.target_url,
    postBody: row.post_body ?? row.post_draft ?? '',
    postDraft: row.post_body ?? row.post_draft ?? '',
    hook: row.hook ?? '',
    angle: row.angle ?? '',
    audience: row.audience ?? '',
    hypothesis: row.hypothesis,
    suggestedScreenshot: row.suggested_screenshot ?? '',
    feedbackAsk: row.feedback_ask ?? '',
    postedUrl: row.posted_url ?? row.post_url,
    postUrl: row.posted_url ?? row.post_url,
    postedAt,
    checkAfter,
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
