import { z } from 'zod'

export const honestFitMarketingExperimentStatusSchema = z.enum([
  'draft',
  'waiting_for_data',
  'learning_captured',
])

export type HonestFitMarketingExperimentStatus = z.infer<
  typeof honestFitMarketingExperimentStatusSchema
>

export type HonestFitMarketingExperiment = {
  id: string
  title: string
  hypothesis: string
  channel: string
  targetUrl: string
  postDraft: string
  status: HonestFitMarketingExperimentStatus
  postUrl: string | null
  postedAt: string | null
  checkAfterHours: number
  learningWhatHappened: string
  learningWhatWasConfusing: string
  nextMessageAngle: string
  createdAt: string
  updatedAt: string
}

export const defaultHonestFitMarketingExperiment = {
  id: 'honestfit-trust-layer-linkedin-v1',
  title: 'Trust Layer public profile LinkedIn post',
  hypothesis:
    'A problem-focused LinkedIn post about claims and evidence will drive qualified visitors to the public Trust profile and reveal whether the message is understandable.',
  channel: 'linkedin',
  targetUrl: 'https://honestfit.ai/c/ken-downey',
  postDraft: `Resumes make claims. They rarely show what supports them.

That's the problem I'm trying to solve with HonestFit.

I just shipped the first live version of HonestFit's Trust Layer: a candidate-controlled public profile with structured career claims, public evidence links, and private evidence controls.

Here's my first public Trust profile:
https://honestfit.ai/c/ken-downey

The question I'm testing is simple:

Can someone understand what a candidate claims, what supports it, and what stays private faster than they can from a normal resume?

I'd appreciate blunt feedback:
- Does the Trust & Evidence section make sense?
- Do the claims feel credible?
- Does the evidence help?
- What's confusing or overclaimed?`,
  checkAfterHours: 24,
} as const

export const updateHonestFitMarketingExperimentSchema = z.object({
  title: z.string().trim().min(1).optional(),
  hypothesis: z.string().trim().min(1).optional(),
  channel: z.string().trim().min(1).optional(),
  targetUrl: z.string().trim().url().optional(),
  postDraft: z.string().trim().min(1).optional(),
  status: honestFitMarketingExperimentStatusSchema.optional(),
  postUrl: z.string().trim().url().nullable().optional(),
  postedAt: z.string().datetime().nullable().optional(),
  checkAfterHours: z.number().int().positive().max(168).optional(),
  learningWhatHappened: z.string().optional(),
  learningWhatWasConfusing: z.string().optional(),
  nextMessageAngle: z.string().optional(),
})

export const markHonestFitMarketingExperimentPostedSchema = z.object({
  postUrl: z.string().trim().url(),
  postedAt: z.string().datetime().optional(),
})

export const saveHonestFitMarketingLearningSchema = z.object({
  learningWhatHappened: z.string(),
  learningWhatWasConfusing: z.string(),
  nextMessageAngle: z.string(),
})

export const marketingExperimentActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update'),
    experiment: updateHonestFitMarketingExperimentSchema,
  }),
  z.object({
    action: z.literal('mark_posted'),
    postUrl: z.string().trim().url(),
    postedAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal('save_learning'),
    learningWhatHappened: z.string(),
    learningWhatWasConfusing: z.string(),
    nextMessageAngle: z.string(),
  }),
  z.object({
    action: z.literal('reset'),
  }),
])

export type MarketingExperimentAction = z.infer<
  typeof marketingExperimentActionSchema
>
