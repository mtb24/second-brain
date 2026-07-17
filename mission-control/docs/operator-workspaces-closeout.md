# Mission Control operator workspaces — closeout

Date: 2026-07-17

Mission starting SHA: `0fcc560a7cc755ac04a8d3bba34146840bce76e3`

HonestFit contract SHA: `4134c90790baa14c0cd7233e02ba12892d62ae91`

HonestFit deployed SHA during validation: `cc954c0dfe6155f70523c4e55534b66e701ed7a9`

## Product definition

Mission Control is now a read-only founder/operator workspace organized around five decisions:

| Workspace | Primary question | Operator outcome |
| --- | --- | --- |
| Today | What needs my attention now? | One canonical production state, at most three recommended actions, release authority, recent change, and compact healthy-system evidence |
| Product | Are users reaching value? | A truthful aggregate-event journey with evidence limitations presented beside the counts |
| Revenue | Is the Job Search Campaign selling and activating correctly? | Campaign purchase, activity, webhook, and current-state evidence separated by authoritative time scope |
| Operations | Is HonestFit functioning reliably? | Canonical subsystem health plus sanitized incidents and safe technical-authority links |
| Feedback | What are users telling us? | A bounded, read-only projection of deterministic operator summaries with explicit available, empty, partial, and unavailable states |

The shell gives urgent operational state priority over editor and marketing controls. Healthy systems collapse; active exceptions remain visible; detail is disclosed on demand. The former combined telemetry wall is no longer rendered by the campaign editor route, while the required campaign editing capabilities remain available at `/campaigns`.

## Source-authority map

| Mission concept | Canonical authority | Mission behavior |
| --- | --- | --- |
| Overall HonestFit health | HonestFit protected Mission summary | Normalizes the top-level state with active incidents, subsystem degradation, warnings, blocking issues, and source staleness so the header and Today cannot contradict each other |
| Production build | HonestFit protected summary `health.appVersion` and sanitized incident `buildSha` | Displays release evidence; never initiates a release or deployment |
| Product activity | HonestFit rolling-24-hour traffic, funnel, and marketing aggregates | Displays event counts only; does not infer people, activation, conversion, cohorts, or retention |
| Campaign purchases and state | HonestFit campaign records | Preserves lifetime purchase-record scope and current-state record counts; Mission does not reinterpret financial authority |
| Campaign and webhook activity | HonestFit rolling-24-hour campaign/billing aggregates | Displays rolling-24-hour evidence separately from lifetime and current-state evidence |
| Incidents | HonestFit sanitized incident projection; Sentry remains technical authority | Displays only protected incident fields and allowlisted HTTPS Sentry links |
| Subsystem health | HonestFit sanitized subsystem projection | Maps application, authentication, source processing, billing/entitlement, Stripe webhooks, voice, and database; release and capacity are marked unavailable when not measured |
| Feedback | HonestFit sanitized feedback projection | Displays only controlled fields and deterministic summaries; never fetches or renders raw feedback |
| Campaign editor | Mission's existing campaign configuration APIs | Preserved as a separate editor capability; it does not precede or obscure system health on Today |

## Adapter reconciliation and compatibility

`src/server/honestFitMissionSummary.ts` explicitly validates and normalizes the protected HonestFit response. It preserves sanitized incidents, subsystem health, campaign aggregates and declared scopes, Product evidence semantics, feedback projection, normalized routes, HF references, safe Sentry links, build SHA, occurrence counts, timestamps, and incident status.

The adapter supports both sides of the current deployment gap:

- Current HonestFit production: missing `feedback` is `contract.feedback = "unavailable"`, never an empty list. Existing campaign values are normalized into the authoritative lifetime, rolling-24-hour, and current-state scopes. Product aggregate counts receive a conservative legacy `event_count_only` evidence declaration.
- New HonestFit contract: valid feedback, Product evidence, campaign scope, incidents, and subsystem fields are preserved after strict parsing.
- Malformed optional sections: only that section is marked malformed or omitted. Today, Product, Revenue, and Operations continue to load when feedback alone cannot be validated.
- Shared fetch failure or missing Mission configuration: the source is shown as failed or unavailable rather than as healthy or zero.

Mission no longer sends a custom campaign `since` parameter. HonestFit's `unsupported_since` behavior is not triggered, and Mission does not display “since posted” wording.

## Feedback privacy contract

Feedback remains read-only. Mission exposes no feedback mutation, raw-browsing route, or cursor.

Allowed item fields are exactly:

- `reference`
- `category`
- `createdAt`
- `status`
- `unread`
- `workspace`
- `route`
- `summary`
- `optionalContextProvided`

Categories are limited to `idea`, `problem`, `confusing`, and `other`. Statuses are limited to `new`, `reviewed`, and `closed`; Mission does not invent `planned`, `resolved`, or `declined`.

The adapter accepts only the deterministic summary that can be independently reconstructed from the allowlisted category and normalized workspace. A mismatched summary or malformed item is dropped. The UI treats this controlled summary as the only operator-readable feedback text.

Mission does not request, retain, or render:

- raw feedback messages or uncontrolled excerpts;
- UUIDs, user/profile identifiers, email, name, authentication identifiers, IP address, raw user agent, cookies, or headers;
- query values, uncontrolled referrers, arbitrary browser or environment payloads;
- Career Memory content, career stories, job descriptions, source content, transcripts, generated content, kits, or evidence;
- Stripe customer, Session, payment, Price, Product, invoice, charge, subscription, entitlement, or other payment identifiers;
- exception messages, stack traces, raw Sentry payloads, or request/response bodies.

Query metadata remains visible and bounded: default limit 25, hard limit 50, newest first, inclusive offset-qualified `feedbackSince`, allowlisted status/category filters, and bounded results without a cursor. `hasMore` produces an explicit bounded-result notice. Contract-available empty state says “No feedback has been submitted yet”; deployed-contract absence says feedback reporting is not yet available.

## Product evidence semantics

Product evidence is `event_count_only`.

- Aggregate event counts can distinguish observed events from zero observed events.
- Unique users, first reviewed story, first Application Kit, Practice entry, return activity, cohorts, and retention are shown as unavailable or unsupported according to the contract.
- Insufficient volume remains distinct from unavailable instrumentation and unsupported measurement.
- Mission never creates zero values for unavailable measurements and never substitutes sessions for people.
- No activation, cohort conversion, or retention claim is made.

## Revenue time semantics

Revenue groups remain separate:

- `lifetime`: campaign purchase records;
- `rolling_24h`: checkout, payment, activation, webhook, and marketing activity;
- `current_state`: active, expired, refunded, disputed, and manual-review campaign records.

Mission does not calculate ratios across these scopes. Zero recent activity with no failures is described as healthy checkout with no observed demand, not as a broken checkout. Payment failure, activation failure, webhook failure, stale webhook evidence, manual review, and refunded/disputed state each have distinct operator copy.

## Operations and Sentry boundary

The incident UI is limited to the HonestFit sanitized projection:

- HF reference;
- severity and allowlisted area/category;
- normalized route;
- affected build SHA;
- occurrence count;
- first and last seen timestamps;
- open, monitoring, or resolved status;
- allowlisted HTTPS Sentry event URL.

Impact and recommended action text are controlled by Mission's incident-category map, not copied from exception content. Sentry remains technical authority. Raw errors, traces, payloads, headers, cookies, identity, private career content, and payment identifiers are not rendered.

HonestFit does not currently declare an incident-origin field. Mission therefore does not guess organic versus controlled synthetic origin. Controlled testing/smoke traffic is distinguished only where aggregate traffic evidence supports that classification; absence of origin evidence is explicit.

## Security boundary

- The Mission server authenticates to HonestFit with the existing bearer secret; the browser never receives that credential.
- Mission's existing authenticated founder session protects workspace and proxy access.
- The adapter performs a cache-bypassed read and introduces no mutation, CSRF relaxation, or production write.
- Optional sections fail closed under schema validation.
- Sentry URLs require HTTPS and a Sentry-owned hostname.
- Routes are stripped of query/fragment values and bounded; controlled tokens, references, SHAs, enums, counts, and timestamps are validated.
- Logging contains fetch state, HTTP status, request ID, or schema issue paths—not the protected response or feedback content.

## Responsive and accessibility evidence

The Playwright matrix covers desktop at 1440 × 900 and mobile at exactly 390 × 844 for all five workspaces.

- one logical H1 per workspace;
- discoverable keyboard-operable workspace navigation, including OpenClaw deep-link access;
- skip link and visible focus transfer to the main region;
- 44px minimum interactive targets in tested Mission routes;
- no horizontal overflow;
- reduced-motion support;
- status text and icons accompany color;
- details/disclosures are keyboard operable;
- normalized routes, long references, and SHAs wrap without expanding the viewport.

Final loaded-state measurements:

| Workspace | Desktop height | 390px height | DOM nodes | Max measured navigation | Overflow elements |
| --- | ---: | ---: | ---: | ---: | ---: |
| Today | 1,008px | 1,850px | 261 | 117ms | 0 |
| Product | 1,620px | 3,069px | 282 | 79ms | 0 |
| Revenue | 1,359px | 2,732px | 270 | 66ms | 0 |
| Operations | 900px | 1,328px | 246 | 68ms | 0 |
| Feedback | 900px | 1,483px | 210 | 58ms | 0 |

Today is 1.12 desktop viewports and 2.19 mobile viewports, down from the audited approximately 4,480px desktop / 8,435px mobile wall. Reviewed Darwin visual baselines for every workspace and viewport are committed under `tests/e2e/mission-workspaces.playwright.ts-snapshots/`.

## Validation evidence

- 83 Vitest unit, contract, model, component, privacy, and regression tests pass.
- TypeScript typecheck passes.
- Repository lint command passes.
- Production build passes.
- Focused Mission Playwright smoke passes on desktop and 390px.
- OpenClaw navigation/proxy regression passes on desktop and 390px.
- All ten reviewed workspace visual comparisons pass when `MISSION_VISUAL_REGRESSION=1`.
- The repository-wide browser run passes 14 tests and skips the two opt-in visual cases. Its two unrelated workout data-flow cases require `DB_URL` or `DATABASE_URL`, which was not configured in the isolated Mission worktree; workout authentication-boundary cases pass.
- `git diff --check` passes.
- Required GitHub Actions checks passed on implementation PRs.

## Change sequence

| PR | Purpose | Merge SHA |
| --- | --- | --- |
| [#15](https://github.com/mtb24/second-brain/pull/15) | Shared shell and typed adapter | `ee2a5eb01bc55921e15db46547493d9b0666c4ea` |
| [#16](https://github.com/mtb24/second-brain/pull/16) | Today | `0204d4f924e17b233ca027484a37e5807f4ab1e8` |
| [#17](https://github.com/mtb24/second-brain/pull/17) | Operations | `8965bf22fbfdce24beebf0e9eb144525e2a6ef9d` |
| [#18](https://github.com/mtb24/second-brain/pull/18) | Product and Revenue | `2c44483d7fa20ff8041e1041687c10c4d7cbb9f5` |
| [#19](https://github.com/mtb24/second-brain/pull/19) | Feedback | `6a1f29209df619b9e3f8925c3eb4e96b6346e8cc` |
| [#20](https://github.com/mtb24/second-brain/pull/20) | Parity, retirement, responsive/accessibility polish, and visual regression | `f8b05a5f48f313ba32b878fc67ec877dd805748c` |

## Boundaries and remaining deployment gap

- No Mission or HonestFit schema or migration changed.
- No HonestFit API changed during this Mission milestone.
- No Mission or HonestFit deployment occurred.
- No production mutation occurred.
- Current HonestFit production still lacks the feedback projection; Feedback therefore shows the explicit not-yet-deployed state until separate deployment authorization is granted.
- The repository Brain was not edited because the primary checkout contains active founder-owned `BRAIN.md` work that this milestone is required to preserve. This closeout document is the durable milestone record.
