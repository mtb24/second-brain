import { z } from 'zod'

export const honestFitMarketingCampaignStatusSchema = z.enum([
  'draft',
  'ready',
  'posted',
  'waiting_for_data',
  'learning_captured',
  'archived',
])

export type HonestFitMarketingCampaignStatus = z.infer<
  typeof honestFitMarketingCampaignStatusSchema
>

export type HonestFitMarketingCampaign = {
  id: string
  title: string
  status: HonestFitMarketingCampaignStatus
  channel: string
  targetUrl: string
  postBody: string
  postDraft: string
  hook: string
  angle: string
  audience: string
  hypothesis: string
  suggestedScreenshot: string
  feedbackAsk: string
  postedUrl: string | null
  postUrl: string | null
  postedAt: string | null
  checkAfter: string | null
  checkAfterHours: number
  learningWhatHappened: string
  learningWhatWasConfusing: string
  nextMessageAngle: string
  createdAt: string
  updatedAt: string
}

export type HonestFitMarketingCampaignState = {
  campaigns: HonestFitMarketingCampaign[]
  selectedCampaignId: string
}

export type HonestFitMarketingExperiment = HonestFitMarketingCampaign
export type HonestFitMarketingExperimentStatus =
  HonestFitMarketingCampaignStatus

const targetUrl = 'https://honestfit.ai/c/ken-downey'

export const preparedHonestFitMarketingCampaignDrafts = [
  {
    id: 'honestfit-problem-first-linkedin-v2',
    title: 'Problem-first Trust Layer post',
    status: 'ready',
    channel: 'linkedin',
    targetUrl,
    hook:
      'A resume is a list of claims. HonestFit helps candidates show what supports them.',
    angle: 'Problem-first',
    audience: 'Hiring managers, recruiters, and senior candidates',
    hypothesis:
      'A direct claims-versus-support hook will earn profile visits from people who already feel resume credibility pain.',
    suggestedScreenshot:
      'Public profile first fold with claims and evidence visible.',
    feedbackAsk:
      'What claim feels strongest, and what evidence would you want before trusting it?',
    postBody: `A resume is a list of claims. HonestFit helps candidates show what supports them.

That is the part I care about most: not making experience sound bigger, but making it easier to inspect.

The Trust Layer profile lets a candidate separate:
- what they claim
- what public evidence supports it
- what stays private unless they choose to share it

Here is the public profile I am using as the first test:
https://honestfit.ai/c/ken-downey

I would love blunt feedback:
What claim feels strongest, and what evidence would you want before trusting it?`,
  },
  {
    id: 'honestfit-recruiter-value-linkedin-v2',
    title: 'Recruiter-value Trust Layer post',
    status: 'ready',
    channel: 'linkedin',
    targetUrl,
    hook:
      'What if a candidate profile showed the claims, the public evidence, and what stays private - before a recruiter has to ask?',
    angle: 'Recruiter-value',
    audience: 'Recruiters, hiring managers, and talent teams',
    hypothesis:
      'Recruiter-facing framing will drive more CTA clicks by making the time-saving value explicit.',
    suggestedScreenshot:
      'Trust & Evidence section plus private evidence controls if visible on the profile.',
    feedbackAsk:
      'Would this reduce back-and-forth, or would you still need the same resume screen?',
    postBody: `What if a candidate profile showed the claims, the public evidence, and what stays private - before a recruiter has to ask?

That is the recruiting workflow I am testing with HonestFit.

A candidate should be able to say "I have done this kind of work" and then show what supports the claim without turning every private document into public marketing copy.

Here is the live profile I am testing:
https://honestfit.ai/c/ken-downey

Recruiters and hiring managers: would this reduce back-and-forth, or would you still need the same resume screen?`,
  },
  {
    id: 'honestfit-candidate-control-linkedin-v2',
    title: 'Candidate-control Trust Layer post',
    status: 'ready',
    channel: 'linkedin',
    targetUrl,
    hook:
      'Candidates should be able to support their career claims without exposing private documents.',
    angle: 'Candidate-control',
    audience: 'Senior candidates, job seekers, and privacy-conscious operators',
    hypothesis:
      'Candidate-control framing will get better replies from people who understand the privacy problem but may not be recruiters.',
    suggestedScreenshot:
      'Candidate public profile showing public evidence links without private files.',
    feedbackAsk:
      'Where is the line between useful evidence and oversharing?',
    postBody: `Candidates should be able to support their career claims without exposing private documents.

That tension is where HonestFit's Trust Layer is headed.

I want candidates to control:
- which claims they make public
- which public links support those claims
- which private evidence stays private
- what a recruiter sees before asking for more

Here is my first public profile:
https://honestfit.ai/c/ken-downey

Where is the line between useful evidence and oversharing?`,
  },
  {
    id: 'honestfit-ai-resume-critique-linkedin-v2',
    title: 'AI-resume critique Trust Layer post',
    status: 'ready',
    channel: 'linkedin',
    targetUrl,
    hook:
      'AI resume tools can rewrite your experience. HonestFit is focused on whether the experience is structured, defensible, and reviewable.',
    angle: 'AI-resume critique',
    audience: 'AI builders, design-system people, recruiters, and candidates using AI tools',
    hypothesis:
      'Contrasting HonestFit with AI resume rewriting will attract AI workflow people and clarify the trust boundary.',
    suggestedScreenshot:
      'Trust profile with a claim, support text, and evidence links visible.',
    feedbackAsk:
      'Does this distinction land, or does it sound too abstract?',
    postBody: `AI resume tools can rewrite your experience. HonestFit is focused on whether the experience is structured, defensible, and reviewable.

I am less interested in making candidates sound polished and more interested in helping them show what is true, what is supported, and what still needs review.

The first Trust Layer profile is live here:
https://honestfit.ai/c/ken-downey

The test:
Can the profile make career claims easier to inspect without turning private context into public content?

Does this distinction land, or does it sound too abstract?`,
  },
] as const satisfies readonly Omit<
  HonestFitMarketingCampaign,
  | 'postedUrl'
  | 'postUrl'
  | 'postDraft'
  | 'postedAt'
  | 'checkAfter'
  | 'checkAfterHours'
  | 'learningWhatHappened'
  | 'learningWhatWasConfusing'
  | 'nextMessageAngle'
  | 'createdAt'
  | 'updatedAt'
>[]

export const defaultHonestFitMarketingExperiment = {
  id: 'honestfit-trust-layer-linkedin-v1',
  title: 'Posted Trust Layer launch post',
  status: 'posted',
  channel: 'linkedin',
  targetUrl,
  hook: 'Resumes make claims. They rarely show what supports them.',
  angle: 'Trust Layer launch',
  audience: 'Recruiters, candidates, and people evaluating career evidence',
  hypothesis:
    'A problem-focused LinkedIn post about claims and evidence will drive qualified visitors to the public Trust profile and reveal whether the message is understandable.',
  suggestedScreenshot: 'First fold of /c/ken-downey plus Trust & Evidence.',
  feedbackAsk:
    'Does the Trust & Evidence section make sense, and what feels overclaimed?',
  postBody: `Resumes make claims. They rarely show what supports them.

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
} as const satisfies Omit<
  HonestFitMarketingCampaign,
  | 'postedUrl'
  | 'postUrl'
  | 'postDraft'
  | 'postedAt'
  | 'checkAfter'
  | 'checkAfterHours'
  | 'learningWhatHappened'
  | 'learningWhatWasConfusing'
  | 'nextMessageAngle'
  | 'createdAt'
  | 'updatedAt'
>

export const updateHonestFitMarketingCampaignSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  status: honestFitMarketingCampaignStatusSchema.optional(),
  channel: z.string().trim().min(1).optional(),
  targetUrl: z.string().trim().url().optional(),
  postBody: z.string().trim().min(1).optional(),
  hook: z.string().trim().min(1).optional(),
  angle: z.string().trim().min(1).optional(),
  audience: z.string().trim().min(1).optional(),
  hypothesis: z.string().trim().min(1).optional(),
  suggestedScreenshot: z.string().trim().min(1).optional(),
  feedbackAsk: z.string().trim().min(1).optional(),
  postedUrl: z.string().trim().url().nullable().optional(),
  postedAt: z.string().datetime().nullable().optional(),
  checkAfter: z.string().datetime().nullable().optional(),
  learningWhatHappened: z.string().optional(),
  learningWhatWasConfusing: z.string().optional(),
  nextMessageAngle: z.string().optional(),
})

export const updateHonestFitMarketingExperimentSchema =
  updateHonestFitMarketingCampaignSchema

export const markHonestFitMarketingExperimentPostedSchema = z.object({
  campaignId: z.string().trim().min(1).optional(),
  postedUrl: z.string().trim().url(),
  postedAt: z.string().datetime().optional(),
})

export const saveHonestFitMarketingLearningSchema = z.object({
  campaignId: z.string().trim().min(1).optional(),
  learningWhatHappened: z.string(),
  learningWhatWasConfusing: z.string(),
  nextMessageAngle: z.string(),
})

export const marketingExperimentActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update'),
    campaignId: z.string().trim().min(1),
    campaign: updateHonestFitMarketingCampaignSchema,
  }),
  z.object({
    action: z.literal('mark_posted'),
    campaignId: z.string().trim().min(1),
    postedUrl: z.string().trim().url(),
    postedAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal('save_learning'),
    campaignId: z.string().trim().min(1),
    learningWhatHappened: z.string(),
    learningWhatWasConfusing: z.string(),
    nextMessageAngle: z.string(),
  }),
  z.object({
    action: z.literal('start_next_campaign'),
    draftId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('archive'),
    campaignId: z.string().trim().min(1),
  }),
])

export type MarketingExperimentAction = z.infer<
  typeof marketingExperimentActionSchema
>
