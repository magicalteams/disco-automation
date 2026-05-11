# Partner Profile Schema Expansion — Proposal

## Why this exists

Every bad match we've seen this week traces back to the same root cause: the matcher is making fuzzy inferences from a 500-word narrative paragraph when it should be making concrete decisions from structured facts.

- Henry was matched to a women-only speaking opportunity because nothing in his profile said he was male.
- Erin was matched to an NYC in-person event happening in three days because nothing in her profile said she was Vermont-based and remote-first.
- Multiple partners were matched to a Planoly tool discount because nothing in their profiles said they don't use Planoly.

The common pattern: the matcher can only reason about facts it can see. When the fact lives buried in a prose paragraph, the matcher often misses it. When the fact doesn't exist on the profile at all, the match is impossible to prevent.

The fix is to stop relying on the AI to infer facts from narrative and start feeding it explicit, structured fields. Once those fields exist, the matching prompt can use hard rejection rules that make bad matches structurally impossible — not "less likely," not "filtered in post," but literally unable to produce a match in the first place.

This document proposes the full set of fields worth adding, organized into tiers so we can roll them out progressively.

---

## Two design principles

**1. Sensitive fields are opt-in only.**
Identity, demographics, parenting status, disability, religion — these only get populated if the partner has explicitly stated them or self-identified in their dossier. The matcher's fallback for any missing opt-in field is: "ineligible for opportunities that filter on this field." We never guess, we never infer, we only use what's stated. This is the fail-safe that prevents the matcher from making demographic assumptions based on a name or photo.

**2. Every field defaults to `null` or `not_specified`.**
The dossier extraction prompt is updated to explicitly ask for each field and return `null` if the dossier doesn't contain it. No field is required to save a profile. This keeps the schema additive — existing profiles don't break when new fields are added, and partial data is still useful data.

---

## Tier 1 — Must-have (fixes known bad matches)

These fields directly close the gaps behind the four quality complaints from this week.

### Identity & demographics (opt-in, hard filters)

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `gender` | enum: `male` / `female` / `nonbinary` / `not_specified` | "male" | Rejects gender-restricted opportunities |
| `pronouns` | string (optional) | "he/him" | Used in email drafts, not for filtering |

### Location (hard filters + context)

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `homeBaseCity` | string | "Burlington" | In-person event filtering |
| `homeBaseState` | string | "Vermont" | Regional filtering |
| `homeBaseCountry` | string | "USA" | Country-level filtering |
| `timezone` | string | "America/New_York" | Time-sensitive events |
| `willingToTravelFor` | enum: `nothing` / `major_only` / `regional` / `anywhere` | "major_only" | Whether in-person elsewhere is worth it |
| `travelRadiusMiles` | integer? | 100 | For "regional" travelers |
| `remoteFirst` | boolean | true | Virtual opportunity weighting |

### Professional format (hard filters)

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `primaryFormats` | string[] | ["writing", "speaking", "advisory"] | What they're available for |
| `openToPodcastGuest` | boolean | true | Category-level filter |
| `openToSpeaking` | boolean | true | Category-level filter |
| `openToPanels` | boolean | true | Category-level filter |
| `openToEditorial` | boolean | true | Category-level filter |
| `openToInvesting` | boolean | false | Category-level filter |

### Tools in use (hard filters for tool discounts)

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `toolsInUse` | string[] | ["Notion", "Airtable", "Stripe"] | Tool discounts only match if already using |
| `toolsConsidering` | string[] | ["Attio", "Pipedrive"] | Demo and trial offers |
| `avoidedTools` | string[] | ["Salesforce", "HubSpot"] | Explicit rejections |

**Tier 1 totals:** 18 fields. These alone eliminate most of the bad-match complaints we've seen.

---

## Tier 2 — High-value (unlocks entire opportunity categories)

These fields unlock categories of opportunities the matcher currently can't evaluate well.

### Business model & stage

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `businessModel` | string[] | ["SaaS", "services"] | Model-specific opportunities |
| `pricingModel` | enum: `subscription` / `project` / `retainer` / `product` / `hourly` | "retainer" | Pricing workshops, case studies |
| `primaryIndustry` | string | "food tech" | Single-industry filters |
| `secondaryIndustries` | string[] | ["sustainability", "CPG"] | Cross-industry matches |
| `industriesAvoided` | string[] | ["crypto", "gambling"] | Off-brand filtering |
| `clientIndustries` | string[] | ["wellness", "nonprofit"] | Who they serve (for agencies) |
| `b2bOrB2c` | enum: `b2b` / `b2c` / `both` / `n_a` | "b2b" | Different opportunity pools |
| `careerStage` | enum: `emerging` / `established` / `veteran` | "established" | Experience-level opportunities |
| `yearsOfExperience` | integer? | 15 | Finer-grained than stage |
| `teamSize` | enum: `solo` / `small_2_10` / `medium_10_50` / `large_50+` | "solo" | Org-size filters |

### Financial specifics

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `fundingStage` | enum: `bootstrapped` / `pre_seed` / `seed` / `series_a+` / `n_a` | "bootstrapped" | Stage-specific investor opportunities |
| `revenueStage` | enum: `pre_revenue` / `under_500k` / `500k_2m` / `2m_10m` / `10m+` | "500k_2m" | Revenue-threshold opportunities |
| `profitability` | enum: `profitable` / `break_even` / `burning` / `not_disclosed` | "profitable" | Opportunities that ask |
| `openToInvestment` | boolean | false | Currently raising? |
| `investmentStage` | enum: `not_raising` / `pre_seed` / `seed` / `series_a` / `beyond` | "not_raising" | Active raise status |
| `seeksNonDilutive` | boolean | true | Grants, contests, pitch competitions |
| `checkSizeSeeking` | string? | "$500k-$1M" | Investor matching |
| `minGrantAmount` | integer? | 10000 | Grant threshold filter |
| `exitsPriorCompanies` | integer | 0 | "Repeat founder" opportunities |

### Content & visibility

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `hasNewsletter` | boolean | true | Newsletter cross-promotion opportunities |
| `newsletterSubscribers` | integer? | 5000 | Threshold opportunities |
| `hasPodcast` | boolean | false | Podcast host opportunities |
| `activePlatforms` | string[] | ["LinkedIn", "Substack"] | Platform-specific opportunities |
| `socialReach` | string? | "~15k LinkedIn followers" | Audience sizing |
| `publishedAuthor` | boolean | false | Author-focused opportunities |
| `contentFocus` | string[] | ["operations", "hiring"] | Topic alignment |
| `openToCollaborativeContent` | boolean | true | Co-writing, guest posts |

### Expertise & credentials

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `expertiseAreas` | string[] | ["scaling operations"] | Topic-specific opportunities |
| `canTeachTopics` | string[] | ["workshop topics"] | Workshop leader opportunities |
| `certifications` | string[] | ["PMP", "DEI Certified"] | Certified-professional opportunities |
| `degrees` | string[] | ["MBA", "MSW"] | Degree-specific programs |
| `awards` | string[] | ["Inc 5000 2024"] | Award-focused programs, alumni opportunities |

### Network & intros

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `openToIntros` | boolean | true | Whether to surface introduction opportunities |
| `lookingFor` | string[] | ["investors", "co-founders"] | Active asks |
| `canOfferIntros` | string[] | ["operators", "marketing leaders"] | What they can give — feeds disco matching |
| `memberOfCommunities` | string[] | ["Chief", "YPO", "EO"] | Existing memberships |
| `closedCommunitiesOnly` | boolean | false | Only invite-only communities |

**Tier 2 totals:** 35 fields. These unlock the majority of newsletter opportunity categories.

---

## Tier 3 — Nice-to-have (refinements)

### Identity expansion (all opt-in)

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `ethnicityIdentity` | string[] (opt-in) | ["Black", "Latina"] | Underrepresented-founder opportunities |
| `lgbtqIdentifies` | boolean (opt-in) | true | LGBTQ+-focused opportunities |
| `ageRange` | enum: `under_30` / `30_45` / `45_60` / `60_plus` | "30_45" | Age-bounded programs |
| `parentingStatus` | enum: `parent` / `not_parent` / `expecting` / `not_specified` | "parent" | Parent-founder communities |
| `veteranStatus` | boolean | false | Veteran-focused opportunities |
| `immigrantFounder` | boolean | false | Immigrant founder communities/grants |
| `firstGeneration` | boolean | false | First-gen founder opportunities |
| `disabilityIdentifies` | boolean (opt-in) | false | Disability-focused opportunities |
| `religiousIdentity` | string? (opt-in) | null | Faith-based communities |
| `languagesSpoken` | string[] | ["English", "Spanish"] | Multilingual opportunities |

### Values & mission

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `missionDriven` | boolean | true | Social impact opportunities |
| `impactAreas` | string[] | ["climate", "education"] | Impact-specific grants, fellowships |
| `deibCommitment` | boolean | true | DEIB-focused programs |
| `bCorpCertified` | boolean | false | B Corp community opportunities |
| `sustainabilityFocused` | boolean | true | Sustainability programs |

### Work style & preferences

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `meetingPreference` | enum: `loves_meetings` / `tolerates` / `avoids` | "tolerates" | Meeting-heavy opportunity filter |
| `introvertExtrovert` | enum: `introvert` / `extrovert` / `ambivert` | "introvert" | Small-group vs large-event opportunities |
| `prefersVirtual` | boolean | true | Virtual vs in-person weighting |
| `prefersSmallGroup` | boolean | true | Mastermind vs conference |
| `prefersFemaleSpaces` | boolean? (opt-in) | null | Women-focused communities |
| `avoidsNetworkingEvents` | boolean | false | Explicit opt-out |
| `prefersAsync` | boolean | true | Async vs live participation |

### Press & media

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `openToPress` | boolean | true | Media opportunities |
| `mediaKit` | boolean | false | Ready media assets |
| `headshotOnFile` | boolean | true | Fast-turnaround opportunities |
| `pressAngles` | string[] | ["women in tech", "sustainability"] | Story hooks for journalists |

### Partnerships

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `openToPartnerships` | boolean | true | Joint ventures, co-marketing |
| `partnershipTypes` | string[] | ["affiliate", "white-label"] | Type-specific matches |
| `hasAffiliateProgram` | boolean | false | Affiliate opportunities |

### Capacity & availability

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `currentCapacity` | enum: `open` / `limited` / `full` / `waitlist` | "limited" | New client opportunities |
| `typicalResponseTime` | enum: `same_day` / `few_days` / `slow` | "few_days" | Time-sensitive opportunities |
| `hoursPerWeekAvailable` | integer? | 10 | Commitment-based opportunities |
| `notSeekingCurrently` | string[] | ["new clients", "speaking gigs"] | Explicit "not right now" |
| `pausedUntil` | date? | "2026-06-01" | Temporary pause on matching |

### Tech stack refinement

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `techStackCategory` | string[] | ["no-code", "AI/ML", "design-forward"] | Tool ecosystems |
| `primaryRevenueChannel` | enum: `direct_sales` / `inbound` / `referral` / `marketplace` / `events` | "referral" | Growth strategy opportunities |

**Tier 3 totals:** 41 fields. Refinements that make good matches better and unlock niche opportunities.

---

## Tier 4 — Behavioral (no dossier work)

These aren't dossier fields — they're computed from reaction data over time. No human data entry required. Built when tiers 1–3 are stable.

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `categoriesSharedRate` | Json | `{"podcast": 0.8, "event": 0.2}` | Learn which categories they actually act on |
| `avgConfidenceThreshold` | float | 0.72 | Their implicit bar for "worth sharing" |
| `lastActiveEngagementDate` | DateTime | "2026-03-28" | Suppress matches if disengaged for months |
| `totalOpportunitiesShared` | integer | 12 | Engagement calibration |
| `totalOpportunitiesSkipped` | integer | 4 | Engagement calibration |

**Tier 4 totals:** 5 fields. Behavioral, computed automatically.

---

## Relationship metadata (orthogonal, add now)

Not about matching quality — about *how* matches get delivered. These address Cara's question about adding prospects and former clients.

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `partnerType` | enum: `active_client` / `prospect` / `former_client` / `referral_partner` | "active_client" | Routing and filtering |
| `assignedStrategist` | string (Slack user ID) | "U0DEF456" | Tagging in notifications |
| `relationshipStartDate` | date | "2025-08-15" | Context for the AI |
| `lastInteractionDate` | date | "2026-04-01" | Nurture sequencing (Phase 3 groundwork) |

---

## Total count by tier

| Tier | Fields | Purpose |
|------|--------|---------|
| Tier 1 | 18 | Fixes known bad matches |
| Tier 2 | 35 | Unlocks entire opportunity categories |
| Tier 3 | 41 | Refinements and niche matching |
| Tier 4 | 5 | Behavioral, auto-computed |
| Metadata | 4 | Relationship routing |
| **Total** | **103** | |

---

## How this changes the matching pipeline

1. **Dossier extraction prompt** updates to explicitly request each field, defaulting to `null` if not stated. Claude Opus handles this well; we're already doing structured extraction.
2. **Newsletter extraction prompt** adds corresponding opportunity fields where relevant (e.g., `requiresGender`, `eventCity`, `isInPerson`, `toolRequired`, `audienceAgeRange`).
3. **Matching prompt** receives all structured fields alongside the summary, with explicit hard-rejection rules:
   - "If opportunity has `requiresGender` and partner's `gender` doesn't match, reject."
   - "If opportunity is in-person in city X and partner's `homeBaseCity` isn't X and `willingToTravelFor` is `nothing` or `major_only`, reject unless it's a major event."
   - "If opportunity is a tool discount for X and `toolsInUse` doesn't include X and `toolsConsidering` doesn't include X, reject."
4. **`matchingNotes` probably goes away** — most of what strategists would try to put there now lives in structured fields that the matcher sees directly.

---

## Two questions this raises

1. **How do these fields get populated?** Some are extractable from the dossier automatically. Others are stated preferences that the dossier won't contain and need human entry. This needs a plan.
2. **Where do humans update them?** Slack slash commands don't scale to 100+ fields. A lightweight frontend for editing partner profiles is probably the right answer. This is covered in the next document.
