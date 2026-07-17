# Mission Marketing Command Center

## Product definition

Marketing is Mission’s sixth HonestFit operator workspace. Its primary question is:

> What should I publish or adjust next?

It combines the existing authenticated campaign workflow with read-only HonestFit marketing evidence. The workspace is decision-first: the next operator move appears before the campaign pipeline, message editor, publishing confirmation, and learning controls.

This milestone does not create an advertising platform. It governs HonestFit’s current organic and owned campaign workflow.

## Source authority

| Information | Authority | Scope |
| --- | --- | --- |
| Campaign drafts, lifecycle, post URL, and qualitative learning | Mission `GET/PATCH /api/honestfit/marketing-experiment` | Current stored campaign state |
| Estimated real traffic, CTA events, sign-in requests, and source rankings | HonestFit protected Mission summary | Rolling 24 hours |
| Campaign-post time | Mission campaign store | Stored timestamp; does not filter HonestFit telemetry |
| Paid spend, budget, impressions, reach, and cost | Unavailable | No connected source |

The two source paths fail independently. If HonestFit telemetry fails, the authenticated campaign editor remains usable and the evidence section reports unavailable. Mission never converts a source failure into zero demand.

The global production strip labels **HonestFit evidence** as read-only. Campaign update controls write only to Mission’s authenticated campaign store; they do not mutate HonestFit production.

## Campaign lifecycle

The existing statuses remain authoritative:

- `draft`: editable campaign in progress;
- `ready`: prepared message available to start or edit;
- `posted` and `waiting_for_data`: live campaign awaiting qualitative learning;
- `learning_captured`: result notes saved and ready to inform the next angle;
- `archived`: read-only history.

No schema, API, authentication, or access-policy change was introduced. Existing mutations remain:

- update campaign;
- mark posted;
- save learning;
- start next campaign.

The UI prevents campaign switching, source refresh, and route exit while local edits are unsaved. Browser reload or tab close receives the standard unsaved-change warning. The operator must save, explicitly discard, or confirm leaving first. Draft-copy saves and posted-URL confirmation are sequenced so one mutation cannot silently discard the other local field set.

## Evidence semantics

Marketing evidence is labeled `Rolling 24 hours` and `Aggregate events · not people`.

- Zero is rendered as zero observed events only when the protected summary loaded successfully.
- Telemetry failure or unavailability is rendered as unavailable, never zero.
- Custom “since posted” attribution is unsupported.
- Mission does not calculate conversion ratios across aggregate events.
- The workspace does not claim campaign-level attribution from the rolling window.

## Paid-media boundary

Mission currently has no authoritative source for ad spend, budgets, impressions, reach, cost per click, or advertising-platform delivery. The workspace states this gap directly and does not fabricate paid-media controls or metrics.

## Responsive and accessibility behavior

- Marketing is part of the primary HonestFit workspace navigation on desktop and mobile.
- OpenClaw remains discoverable from the mobile header without adding a third navigation row.
- Interactive controls have a minimum 44-pixel target.
- One logical H1 is used for the route.
- Status is always expressed in text, not color alone.
- Disclosures and campaign selection are keyboard-operable.
- Reduced-motion preferences are respected by the shared Mission shell.
- Desktop and 390px layouts have no horizontal overflow.

## Deployment

This change is repository-only until a separate Mission deployment is authorized. It does not deploy HonestFit or Mission.
