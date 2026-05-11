# Partner Profile Field Definitions

Every field from SCHEMA-EXPANSION-PROPOSAL.md, with a clear definition and an example of what a valid response looks like. This is the reference for the dossier extraction prompt and the human-facing editor.

**Conventions:**
- Fields marked "opt-in" are never inferred. If the dossier doesn't explicitly state it, the value is `null` or `not_specified`.
- Array fields default to `[]` if no values are found.
- Boolean fields should only be `true`/`false` when explicitly supported by dossier evidence; otherwise `null`.

---

## Tier 1 — Must-have

### Identity & demographics

**`gender`** — The partner's stated gender identity. Only set if the dossier explicitly states it or the partner has self-identified. Never inferred from a name or photo.
- Type: enum (`male` / `female` / `nonbinary` / `not_specified`)
- Example: `"female"`

**`pronouns`** — The pronouns the partner uses. Pulled from their stated pronouns in dossier, bio, or profile. Used only for email drafts, never for filtering.
- Type: string (nullable)
- Example: `"she/her"`

### Location

**`homeBaseCity`** — The city where the partner primarily lives and works. The location they return to between travel.
- Type: string (nullable)
- Example: `"Burlington"`

**`homeBaseState`** — The state or province of the partner's home base.
- Type: string (nullable)
- Example: `"Vermont"`

**`homeBaseCountry`** — The country of the partner's home base.
- Type: string (nullable)
- Example: `"USA"`

**`timezone`** — The IANA timezone identifier for the partner's home base, used for time-sensitive event matching.
- Type: string (nullable)
- Example: `"America/New_York"`

**`willingToTravelFor`** — How much travel the partner will accept for in-person opportunities. `nothing` means remote-only; `major_only` means only significant events justify travel; `regional` means travel within a local radius; `anywhere` means they travel freely.
- Type: enum (`nothing` / `major_only` / `regional` / `anywhere`)
- Example: `"major_only"`

**`travelRadiusMiles`** — For partners who said `regional`, the approximate distance they're willing to travel from their home base.
- Type: integer (nullable)
- Example: `100`

**`remoteFirst`** — Whether the partner prefers virtual/remote engagements over in-person. True means they actively prefer virtual; false means they're comfortable in person.
- Type: boolean
- Example: `true`

### Professional format

**`primaryFormats`** — The main ways this partner shows up professionally. What they actually do, beyond their job title.
- Type: string[]
- Example: `["writing", "speaking", "advisory"]`

**`openToPodcastGuest`** — Whether the partner is actively open to appearing as a guest on podcasts.
- Type: boolean (nullable)
- Example: `true`

**`openToSpeaking`** — Whether the partner is actively open to speaking engagements (keynotes, workshops, panels, events).
- Type: boolean (nullable)
- Example: `true`

**`openToPanels`** — Whether the partner is specifically open to panel discussions (separate from keynote speaking).
- Type: boolean (nullable)
- Example: `true`

**`openToEditorial`** — Whether the partner is open to writing editorial content (articles, guest posts, contributed pieces).
- Type: boolean (nullable)
- Example: `true`

**`openToInvesting`** — Whether the partner is an active or potential investor and open to investment opportunities.
- Type: boolean (nullable)
- Example: `false`

### Tools in use

**`toolsInUse`** — Software tools and platforms the partner currently uses in their business. Tool-specific discounts only match if the partner is already using the tool.
- Type: string[]
- Example: `["Notion", "Airtable", "Stripe", "Slack"]`

**`toolsConsidering`** — Tools the partner has mentioned evaluating or considering adopting. These are candidates for demo and trial offers.
- Type: string[]
- Example: `["Attio", "Pipedrive"]`

**`avoidedTools`** — Tools the partner has explicitly rejected or moved away from. These are automatic non-matches for tool-specific opportunities.
- Type: string[]
- Example: `["Salesforce", "HubSpot"]`

---

## Tier 2 — High-value

### Business model & stage

**`businessModel`** — How the partner makes money. Can include multiple models if applicable.
- Type: string[]
- Example: `["SaaS", "services"]`

**`pricingModel`** — The primary way the partner charges clients. For agencies and service providers; may be `null` for product companies.
- Type: enum (`subscription` / `project` / `retainer` / `product` / `hourly`)
- Example: `"retainer"`

**`primaryIndustry`** — The single industry the partner is most identified with. More specific than a broad category ("food tech" not "business").
- Type: string
- Example: `"food tech"`

**`secondaryIndustries`** — Additional industries the partner operates in beyond their primary. Captures cross-industry partners.
- Type: string[]
- Example: `["sustainability", "CPG"]`

**`industriesAvoided`** — Industries the partner explicitly does not want to work in or be associated with. Used for off-brand filtering.
- Type: string[]
- Example: `["crypto", "gambling"]`

**`clientIndustries`** — For service providers and agencies: the industries their clients operate in. Different from the partner's own industry.
- Type: string[]
- Example: `["wellness", "nonprofit"]`

**`b2bOrB2c`** — Whether the partner primarily serves businesses, consumers, both, or neither.
- Type: enum (`b2b` / `b2c` / `both` / `n_a`)
- Example: `"b2b"`

**`careerStage`** — A rough bucket for the partner's career maturity. `emerging` is early career or newly founded; `established` is experienced and recognized; `veteran` is a long-time industry figure.
- Type: enum (`emerging` / `established` / `veteran`)
- Example: `"established"`

**`yearsOfExperience`** — Approximate years of professional experience in their current field.
- Type: integer (nullable)
- Example: `15`

**`teamSize`** — The size of the partner's company or team.
- Type: enum (`solo` / `small_2_10` / `medium_10_50` / `large_50+`)
- Example: `"solo"`

### Financial specifics

**`fundingStage`** — For startup founders: what stage of funding their company is in. `n_a` for non-startups (agencies, solo operators, nonprofits).
- Type: enum (`bootstrapped` / `pre_seed` / `seed` / `series_a+` / `n_a`)
- Example: `"bootstrapped"`

**`revenueStage`** — Approximate annual revenue bucket for the partner's business. Sensitive; set only if disclosed.
- Type: enum (`pre_revenue` / `under_500k` / `500k_2m` / `2m_10m` / `10m+`)
- Example: `"500k_2m"`

**`profitability`** — Whether the business is currently profitable, breaking even, or burning cash. Sensitive; set only if disclosed.
- Type: enum (`profitable` / `break_even` / `burning` / `not_disclosed`)
- Example: `"profitable"`

**`openToInvestment`** — Whether the partner is actively raising or open to investment right now. Volatile field, update as circumstances change.
- Type: boolean
- Example: `false`

**`investmentStage`** — If raising, what round they're raising for.
- Type: enum (`not_raising` / `pre_seed` / `seed` / `series_a` / `beyond`)
- Example: `"not_raising"`

**`seeksNonDilutive`** — Whether the partner is actively looking for grants, pitch competition prizes, or other non-equity funding.
- Type: boolean
- Example: `true`

**`checkSizeSeeking`** — If raising, the approximate round size. Free-text because rounds vary widely in structure.
- Type: string (nullable)
- Example: `"$500k-$1M"`

**`minGrantAmount`** — The minimum grant amount worth the application effort. Grants below this threshold are not surfaced.
- Type: integer (nullable)
- Example: `10000`

**`exitsPriorCompanies`** — Number of successful exits (acquisitions, IPOs) from prior companies. Signals "repeat founder" for opportunities targeting that profile.
- Type: integer
- Example: `0`

### Content & visibility

**`hasNewsletter`** — Whether the partner publishes a regular newsletter.
- Type: boolean
- Example: `true`

**`newsletterSubscribers`** — Approximate subscriber count if known. Volatile; update opportunistically.
- Type: integer (nullable)
- Example: `5000`

**`hasPodcast`** — Whether the partner hosts their own podcast.
- Type: boolean
- Example: `false`

**`activePlatforms`** — The primary platforms where the partner is actively publishing or building audience.
- Type: string[]
- Example: `["LinkedIn", "Substack"]`

**`socialReach`** — A qualitative or quantitative sense of the partner's audience size. Free-text because metrics vary across platforms.
- Type: string (nullable)
- Example: `"~15k LinkedIn followers"`

**`publishedAuthor`** — Whether the partner has published a book (traditional or self-published).
- Type: boolean
- Example: `false`

**`contentFocus`** — The topics the partner's content centers on. Different from their industry — what they write/talk about, not what they sell.
- Type: string[]
- Example: `["operations", "hiring", "leadership"]`

**`openToCollaborativeContent`** — Whether the partner is open to co-authoring, joint webinars, guest posts, or other collaborative content work.
- Type: boolean
- Example: `true`

### Expertise & credentials

**`expertiseAreas`** — Specific topics the partner is recognized as an expert in. Finer-grained than `contentFocus`, used for speaking and writing opportunity matches.
- Type: string[]
- Example: `["scaling operations", "remote team management", "DEI hiring"]`

**`canTeachTopics`** — Topics the partner is willing and able to teach in a workshop or training context. Subset of expertise that they'd actively lead.
- Type: string[]
- Example: `["building SOPs from scratch", "process documentation"]`

**`certifications`** — Professional certifications that may be required or preferred for certain opportunities.
- Type: string[]
- Example: `["PMP", "DEI Certified", "Scrum Master"]`

**`degrees`** — Formal academic degrees held by the partner. Relevant for alumni programs and degree-specific opportunities.
- Type: string[]
- Example: `["MBA", "MSW"]`

**`awards`** — Industry awards, recognitions, or honors the partner has received. Relevant for award alumni programs and opportunities targeting recognized professionals.
- Type: string[]
- Example: `["Inc 5000 2024", "Forbes 30 Under 30"]`

### Network & intros

**`openToIntros`** — Whether the partner is receptive to being introduced to new people through Magical Teams' network. Default true unless explicitly opted out.
- Type: boolean
- Example: `true`

**`lookingFor`** — What the partner is actively trying to find or connect with. Pulled from stated goals in the dossier.
- Type: string[]
- Example: `["investors", "co-founders", "technical advisors"]`

**`canOfferIntros`** — The types of people the partner can introduce others to. Powers the reverse direction of disco matching.
- Type: string[]
- Example: `["operators", "marketing leaders", "B Corp founders"]`

**`memberOfCommunities`** — Professional communities the partner already belongs to. Prevents recommending communities they're already in.
- Type: string[]
- Example: `["Chief", "YPO", "EO"]`

**`closedCommunitiesOnly`** — Whether the partner prefers invite-only, closed communities over public networking. Reflects a preference for signal over scale.
- Type: boolean
- Example: `false`

---

## Tier 3 — Nice-to-have

### Identity expansion (opt-in)

**`ethnicityIdentity`** — The partner's self-identified ethnic or racial background. Opt-in only; never inferred from name or photo. Used to match opportunities for underrepresented founders.
- Type: string[] (opt-in)
- Example: `["Black", "Latina"]`

**`lgbtqIdentifies`** — Whether the partner identifies as LGBTQ+. Opt-in only; used for LGBTQ+-focused opportunities.
- Type: boolean (opt-in, nullable)
- Example: `true`

**`ageRange`** — Rough age bucket of the partner. Used for age-bounded opportunities like "30 Under 30" programs.
- Type: enum (`under_30` / `30_45` / `45_60` / `60_plus`)
- Example: `"30_45"`

**`parentingStatus`** — Whether the partner is a parent. Relevant for parent-founder communities and family-focused opportunities.
- Type: enum (`parent` / `not_parent` / `expecting` / `not_specified`)
- Example: `"parent"`

**`veteranStatus`** — Whether the partner is a military veteran. Opt-in; used for veteran-focused programs.
- Type: boolean (opt-in)
- Example: `false`

**`immigrantFounder`** — Whether the partner identifies as an immigrant founder. Used for immigrant-focused communities and grant programs.
- Type: boolean
- Example: `false`

**`firstGeneration`** — Whether the partner is a first-generation American or first-generation college graduate. Used for first-gen founder opportunities.
- Type: boolean
- Example: `false`

**`disabilityIdentifies`** — Whether the partner self-identifies as having a disability. Opt-in only; used for disability-focused opportunities.
- Type: boolean (opt-in)
- Example: `false`

**`religiousIdentity`** — The partner's religious identity, if stated. Opt-in only; used for faith-based community opportunities.
- Type: string (opt-in, nullable)
- Example: `null`

**`languagesSpoken`** — Languages the partner speaks fluently. Relevant for multilingual or international opportunities.
- Type: string[]
- Example: `["English", "Spanish"]`

### Values & mission

**`missionDriven`** — Whether the partner's business is explicitly mission-driven (social or environmental impact as a core purpose).
- Type: boolean
- Example: `true`

**`impactAreas`** — For mission-driven partners, the specific impact areas they work in. Used for impact-specific grants and fellowships.
- Type: string[]
- Example: `["climate", "education", "food security"]`

**`deibCommitment`** — Whether the partner has a stated commitment to Diversity, Equity, Inclusion, and Belonging. Used for DEIB-focused programs.
- Type: boolean
- Example: `true`

**`bCorpCertified`** — Whether the partner's company holds B Corp certification.
- Type: boolean
- Example: `false`

**`sustainabilityFocused`** — Whether sustainability is a core part of the partner's work or brand.
- Type: boolean
- Example: `true`

### Work style & preferences

**`meetingPreference`** — How the partner feels about meetings as a format. Affects whether to surface meeting-heavy opportunities like masterminds.
- Type: enum (`loves_meetings` / `tolerates` / `avoids`)
- Example: `"tolerates"`

**`introvertExtrovert`** — Rough preference between small-group and large-group settings. Used for matching community type (intimate masterminds vs large conferences).
- Type: enum (`introvert` / `extrovert` / `ambivert`)
- Example: `"introvert"`

**`prefersVirtual`** — Whether the partner actively prefers virtual over in-person engagements, beyond just remote-first logistics.
- Type: boolean
- Example: `true`

**`prefersSmallGroup`** — Whether the partner prefers small-group settings (masterminds, dinners, retreats) over large events (conferences, summits).
- Type: boolean
- Example: `true`

**`prefersFemaleSpaces`** — Whether the partner has expressed a preference for women-focused professional spaces. Opt-in only.
- Type: boolean (opt-in, nullable)
- Example: `null`

**`avoidsNetworkingEvents`** — Whether the partner has explicitly said they dislike networking events. True means skip all networking event matches.
- Type: boolean
- Example: `false`

**`prefersAsync`** — Whether the partner prefers asynchronous collaboration (written, async) over synchronous (calls, live sessions).
- Type: boolean
- Example: `true`

### Press & media

**`openToPress`** — Whether the partner is currently open to press and media opportunities.
- Type: boolean
- Example: `true`

**`mediaKit`** — Whether the partner has a prepared media kit (bio, headshots, talking points) ready to send.
- Type: boolean
- Example: `false`

**`headshotOnFile`** — Whether the partner has a usable professional headshot available. Relevant for fast-turnaround opportunities needing a bio + photo.
- Type: boolean
- Example: `true`

**`pressAngles`** — The story hooks or angles that make the partner interesting to journalists. What a press pitch would lead with.
- Type: string[]
- Example: `["women in tech", "bootstrapped to 7 figures", "sustainability in CPG"]`

### Partnerships

**`openToPartnerships`** — Whether the partner is currently open to business partnerships like joint ventures, co-marketing, or channel deals.
- Type: boolean
- Example: `true`

**`partnershipTypes`** — If open to partnerships, the specific types they'd consider.
- Type: string[]
- Example: `["affiliate", "white-label", "referral"]`

**`hasAffiliateProgram`** — Whether the partner already runs an affiliate program, relevant for affiliate-focused opportunities.
- Type: boolean
- Example: `false`

### Capacity & availability

**`currentCapacity`** — The partner's current workload availability. Affects whether to surface new-client or new-project opportunities.
- Type: enum (`open` / `limited` / `full` / `waitlist`)
- Example: `"limited"`

**`typicalResponseTime`** — How quickly the partner typically responds. Used to gauge whether they can handle time-sensitive opportunities.
- Type: enum (`same_day` / `few_days` / `slow`)
- Example: `"few_days"`

**`hoursPerWeekAvailable`** — Approximate hours per week the partner has available for new commitments.
- Type: integer (nullable)
- Example: `10`

**`notSeekingCurrently`** — Categories of opportunity the partner has explicitly said they're not interested in right now.
- Type: string[]
- Example: `["new clients", "speaking gigs"]`

**`pausedUntil`** — A future date after which matching should resume. If set, the partner is temporarily excluded from all matching until this date.
- Type: date (nullable)
- Example: `"2026-06-01"`

### Tech stack refinement

**`techStackCategory`** — The broad tool ecosystems the partner's business lives in. Higher-level than individual tools.
- Type: string[]
- Example: `["no-code", "AI/ML", "design-forward"]`

**`primaryRevenueChannel`** — The main way the partner acquires business. Used for growth strategy opportunities.
- Type: enum (`direct_sales` / `inbound` / `referral` / `marketplace` / `events`)
- Example: `"referral"`

---

## Tier 4 — Behavioral (auto-computed)

**`categoriesSharedRate`** — The rate at which the partner's pod has shared matches in each opportunity category. Computed from reaction data over time.
- Type: Json
- Example: `{"podcast": 0.8, "event": 0.2, "editorial": 0.65}`

**`avgConfidenceThreshold`** — The average confidence score of matches the pod has actually shared. Indicates the implicit quality bar the pod applies.
- Type: float
- Example: `0.72`

**`lastActiveEngagementDate`** — The most recent date a pod reacted to any match for this partner. Used to suppress matching for disengaged partners.
- Type: DateTime
- Example: `"2026-03-28T14:22:00Z"`

**`totalOpportunitiesShared`** — Lifetime count of matches the pod has marked as shared.
- Type: integer
- Example: `12`

**`totalOpportunitiesSkipped`** — Lifetime count of matches the pod has marked as skipped.
- Type: integer
- Example: `4`

---

## Relationship metadata

**`partnerType`** — What kind of relationship Magical Teams has with this person. Controls routing and filtering across the matching system.
- Type: enum (`active_client` / `prospect` / `former_client` / `referral_partner`)
- Example: `"active_client"`

**`assignedStrategist`** — The Slack user ID of the strategist assigned to this partner. Used to tag in match notifications and feedback routing.
- Type: string (nullable)
- Example: `"U0DEF456"`

**`relationshipStartDate`** — The date the partnership began. Provides context for matching decisions.
- Type: date (nullable)
- Example: `"2025-08-15"`

**`lastInteractionDate`** — The date of the most recent meaningful interaction with this partner. Foundation for future nurture sequencing.
- Type: date (nullable)
- Example: `"2026-04-01"`
