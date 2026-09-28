# Music Intelligence Agent

## 1. Overview

Music Intelligence Agent is an AI-powered system designed to monitor the current music news ecosystem and identify the **10 most relevant music stories being discussed at the moment** across Argentina, the United States and Europe.

The system should combine information from:

* Music news websites
* RSS feeds
* Public web sources
* YouTube channels
* X / Twitter
* Instagram
* TikTok
* Other relevant music sources

The goal is **not to build a permanent news database**.

The system should behave primarily as a real-time intelligence layer:

```text
Sources
   ↓
Collection
   ↓
Normalization
   ↓
Topic / Entity Detection
   ↓
Story Clustering
   ↓
Trend Analysis
   ↓
AI Analysis
   ↓
Ranking
   ↓
TOP 10
```

Only temporary trend state should be stored.

---

# 2. Main Objective

The agent must answer:

> "What are the 10 most important or relevant music stories being discussed right now?"

The answer must consider:

* Argentina
* United States
* Europe
* Global relevance

The system should not simply return the latest 10 published articles.

It must identify **stories/topics**, combining multiple sources discussing the same event.

Example:

```text
Rolling Stone:
Oasis announces 2027 tour

NME:
Oasis confirms 2027 dates

X:
Oasis 2027 trending

YouTube:
Multiple music channels discuss Oasis tour

Instagram:
Official Oasis announcement receives high engagement
```

These should become:

```text
Oasis announces 2027 tour
```

and not five separate entries.

---

# 3. Core Principles

## 3.1 Real-time first

The system prioritizes what is happening now.

Historical analysis is not part of the MVP.

---

## 3.2 Minimal persistence

The system must NOT permanently store:

* Complete articles
* Complete social media posts
* Complete YouTube transcripts
* Images
* Videos
* User-generated content
* Large amounts of scraped content

The system may temporarily store:

* Topic
* Artist
* Event
* Region
* Genre
* Source
* URL
* Timestamp
* Number of detected sources
* Engagement metrics when available
* Trend velocity
* Temporary score

---

## 3.3 Temporary state

Redis should be used for temporary trend information.

Example:

```json
{
  "topic": "Oasis 2027 Tour",
  "mentions": 42000,
  "velocity": 0.82,
  "regions": ["UK", "USA", "Argentina"],
  "sources": 7,
  "score": 9.4,
  "last_seen": "2026-09-28T11:30:00"
}
```

Trend information should expire automatically.

Initial TTL:

```text
24-48 hours
```

This value must be configurable.

---

# 4. MVP Architecture

## Backend

* Node.js
* NestJS
* TypeScript

## Queue / temporary state

* Redis
* BullMQ

## Database

No PostgreSQL in MVP.

A database may be introduced in a future version if historical analytics or permanent storage becomes necessary.

## AI

The LLM provider must be abstracted behind an internal service.

Example:

```text
AIService
   ↓
LLM Provider
```

This allows changing models without modifying the rest of the application.

## Frontend

Optional in the first iteration.

The MVP should initially be usable through:

* CLI
* API endpoint
* Scheduled report
* Telegram / email in a later phase

---

# 5. High-Level Architecture

```text
                    ┌──────────────────────┐
                    │       SOURCES        │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
          News/RSS         YouTube          Social
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │     COLLECTORS        │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │    NORMALIZATION     │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ ENTITY EXTRACTION    │
                    │                      │
                    │ Artist               │
                    │ Album                │
                    │ Song                 │
                    │ Event                │
                    │ Festival             │
                    │ Tour                 │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ STORY CLUSTERING     │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ TREND ENGINE         │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ AI EDITOR            │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │ RANKING ENGINE       │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │      TOP 10          │
                    └──────────────────────┘
```

---

# 6. Source Categories

## 6.1 Argentina / Latin America

Initial sources:

* Rolling Stone Argentina
* Indie Hoy
* Billboard Argentina
* Other relevant Argentine music media

The source list must be configurable.

---

## 6.2 United States

Initial sources:

* Rolling Stone
* Pitchfork
* Billboard
* Stereogum
* Consequence
* Spin
* BrooklynVegan
* Loudwire
* Metal Injection

---

## 6.3 Europe / UK

Initial sources:

* NME
* Kerrang!
* Metal Hammer
* The Guardian Music
* MOJO
* Clash
* DIY
* Dork
* Uncut

---

# 7. YouTube Sources

The system should support specific YouTube channels.

Initial channels:

* The Needle Drop / Anthony Fantano
* El Cuartel del Metal

The architecture must allow adding channels without changing application code.

Example configuration:

```typescript
{
  name: "The Needle Drop",
  channelId: "...",
  region: "USA",
  genres: ["rock", "alternative", "indie", "pop"]
}
```

---

# 8. Social Sources

Social platforms should be implemented through independent adapters.

```text
SocialSource
    ├── XAdapter
    ├── InstagramAdapter
    └── TikTokAdapter
```

The application must not assume that every platform provides the same data.

Each adapter should expose only the data actually available through its API or permitted public sources.

Example normalized result:

```typescript
interface SocialSignal {
  platform: string;
  topic: string;
  artist?: string;
  mentions?: number;
  engagement?: number;
  velocity?: number;
  region?: string;
  detectedAt: Date;
}
```

---

# 9. Source Adapter Architecture

Every source should implement a common interface.

Example:

```typescript
interface SourceAdapter {
  getItems(): Promise<RawSourceItem[]>;
}
```

Possible adapters:

```text
RSSAdapter
WebAdapter
YouTubeAdapter
XAdapter
InstagramAdapter
TikTokAdapter
```

The collector should not know the internal implementation of each source.

---

# 10. Normalized Source Item

All collected information must be converted into a common structure.

Example:

```typescript
interface SourceItem {
  source: string;
  sourceType: 'news' | 'youtube' | 'social';
  title?: string;
  description?: string;
  url: string;
  publishedAt?: Date;

  artist?: string;
  region?: string;
  genre?: string;

  engagement?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}
```

The raw content should NOT be persisted permanently.

---

# 11. Entity Detection

The system must identify entities such as:

* Artists
* Bands
* Songs
* Albums
* Festivals
* Tours
* Venues
* Record labels
* Awards
* Music events

Example:

```text
"Oasis announce 2027 world tour"
```

Should produce:

```json
{
  "artists": ["Oasis"],
  "eventType": "tour",
  "year": 2027
}
```

---

# 12. Story Types

The system should classify stories.

Initial categories:

```text
NEW_RELEASE
ALBUM
SINGLE
TOUR
CONCERT
FESTIVAL
REUNION
COLLABORATION
INTERVIEW
CONTROVERSY
AWARD
CHART
DEATH
ANNOUNCEMENT
MUSIC_VIDEO
VIRAL
RUMOR
OTHER
```

---

# 13. Story Clustering

This is one of the most important components.

Different sources discussing the same event must be grouped into one story.

Example:

```text
Article A
Article B
YouTube video
X discussion
Instagram post
```

↓

```text
STORY: Artist announces new album
```

The clustering system should use:

1. Artist/entity similarity
2. Event type
3. Keywords
4. Time proximity
5. Semantic similarity
6. LLM validation when necessary

The system must avoid creating duplicate stories.

---

# 14. Trend Engine

The trend engine determines how relevant a story is.

Initial factors:

```text
Source count
Source authority
Social volume
Social engagement
Velocity
Geographic spread
Cross-platform presence
Freshness
Official confirmation
```

---

# 15. Trend Velocity

Velocity measures how quickly attention around a topic is increasing.

Example:

```text
10:00 → 2,000 mentions
11:00 → 4,000 mentions
```

Growth:

```text
+100%
```

A topic with rapid growth should receive a higher trend score even if its absolute volume is lower.

---

# 16. Cross-Platform Signal

A topic appearing on several platforms should receive additional relevance.

Example:

```text
News
✓

X
✓

YouTube
✓

Instagram
✓

TikTok
✓
```

This indicates stronger cross-platform relevance.

---

# 17. Initial Scoring Model

Initial score:

```text
25% Source Volume
20% Trend Velocity
20% Social Engagement
15% Source Authority
10% Geographic Reach
10% Freshness
```

The scoring system must be configurable.

Do not hard-code these percentages throughout the application.

Create a configuration object.

Example:

```typescript
const scoringWeights = {
  sourceVolume: 0.25,
  velocity: 0.20,
  engagement: 0.20,
  authority: 0.15,
  geographicReach: 0.10,
  freshness: 0.10,
};
```

---

# 18. Geographic Analysis

Each story should be associated with one or more regions.

Initial regions:

```text
ARGENTINA
USA
EUROPE
GLOBAL
```

Europe may later be divided into:

```text
UK
SPAIN
FRANCE
GERMANY
ITALY
OTHER_EUROPE
```

Example:

```json
{
  "regions": [
    "USA",
    "UK",
    "ARGENTINA"
  ]
}
```

---

# 19. Genre Classification

Initial genres:

```text
ROCK
ALTERNATIVE
INDIE
METAL
PUNK
POP
HIP_HOP
ELECTRONIC
PUNK
PROG
POST_PUNK
LATIN
OTHER
```

An artist may belong to multiple genres.

---

# 20. AI Editor

After the trend engine identifies candidate stories, the AI editor produces the final editorial representation.

Input:

```text
Story
Sources
Signals
Regions
Genres
Engagement
Trend data
```

Output:

```json
{
  "title": "...",
  "summary": "...",
  "whyItMatters": "...",
  "storyType": "TOUR",
  "regions": ["USA", "EUROPE"],
  "genres": ["ROCK"],
  "confidence": 0.94
}
```

The AI must not invent facts.

If information is uncertain, it must explicitly identify it as:

```text
RUMOR
UNCONFIRMED
CONTESTED
```

---

# 21. Source Verification

The agent should distinguish:

```text
CONFIRMED
LIKELY
UNCONFIRMED
RUMOR
```

Official artist announcements and primary sources should have higher authority.

A rumor repeated by multiple websites must NOT automatically become a confirmed story.

---

# 22. Final Top 10

The final result should contain a maximum of 10 stories.

Example:

```text
🔥 TOP 10 MUSIC STORIES

1. Oasis announces...
   🇬🇧 🇺🇸 🇦🇷
   ROCK · TOUR
   Trend: 🔥🔥🔥🔥
   Sources: 8

2. ...
```

Each story should contain:

* Position
* Title
* Short summary
* Artist(s)
* Story type
* Region
* Genre
* Trend level
* Number of sources
* Source links
* Confidence
* Timestamp

---

# 23. Output Format

The API should return structured JSON.

Example:

```json
{
  "generatedAt": "2026-09-28T11:30:00Z",
  "stories": [
    {
      "rank": 1,
      "title": "Oasis announces 2027 world tour",
      "summary": "...",
      "artists": ["Oasis"],
      "type": "TOUR",
      "regions": ["EUROPE", "USA", "ARGENTINA"],
      "genres": ["ROCK"],
      "score": 9.4,
      "trendLevel": "VERY_HIGH",
      "sourceCount": 7,
      "confidence": 0.94,
      "sources": [
        {
          "name": "Rolling Stone",
          "url": "..."
        }
      ]
    }
  ]
}
```

---

# 24. Redis

Redis is responsible for temporary state.

Possible keys:

```text
music:trend:{topic}
music:story:{hash}
music:source:{source}
music:run:{timestamp}
```

All keys must have TTL.

No indefinite persistence.

Example:

```text
music:trend:oasis-2027
TTL: 24h
```

---

# 25. BullMQ

BullMQ should handle asynchronous processing.

Initial queues:

```text
source-collection
normalization
entity-analysis
story-clustering
trend-analysis
ai-analysis
ranking
```

Example:

```text
Cron
 ↓
source-collection
 ↓
normalization
 ↓
entity-analysis
 ↓
story-clustering
 ↓
trend-analysis
 ↓
ai-analysis
 ↓
ranking
```

---

# 26. Scheduling

Initial collection intervals:

```text
News/RSS: 15 minutes
YouTube: 30 minutes
Social: 10-15 minutes
```

These must be configurable.

The final Top 10 can be generated:

* On demand
* Every hour
* At a configured schedule

---

# 27. MVP API

Initial endpoints:

```http
GET /health

GET /api/news/top

GET /api/news/top?region=argentina

GET /api/news/top?region=usa

GET /api/news/top?region=europe

GET /api/news/top?genre=rock

GET /api/trends

POST /api/news/refresh
```

---

# 28. CLI

The MVP should also have a CLI.

Examples:

```bash
npm run collect
```

```bash
npm run analyze
```

```bash
npm run top
```

```bash
npm run refresh
```

```bash
npm run worker
```

A complete run should be possible with:

```bash
npm run music-intelligence
```

---

# 29. Initial Development Phases

## Phase 1 — Project setup

* NestJS
* TypeScript
* ESLint
* Prettier
* Jest
* Redis
* BullMQ
* Environment configuration
* Docker Compose

---

## Phase 2 — RSS / News collectors

Implement:

* Rolling Stone
* Indie Hoy
* Pitchfork
* NME
* Billboard
* Stereogum
* Consequence

Create the generic `SourceAdapter`.

---

## Phase 3 — Normalization

Implement:

* Title normalization
* Date normalization
* Source normalization
* Artist detection
* Region detection
* Genre detection

---

## Phase 4 — Story clustering

Implement:

* Similarity
* Entity matching
* Time window
* Duplicate detection
* LLM validation

---

## Phase 5 — Trend engine

Implement:

* Source count
* Velocity
* Freshness
* Cross-platform signals
* Geographic reach
* Score

---

## Phase 6 — YouTube

Implement:

* Channel configuration
* New video detection
* Metadata analysis
* Transcript analysis where available
* Artist/entity extraction
* Engagement signals

Initial channels:

* The Needle Drop
* El Cuartel del Metal

---

## Phase 7 — Social

Implement adapters according to each platform's available and permitted APIs.

Priority:

```text
X
TikTok
Instagram
```

Do not implement scraping mechanisms that violate platform terms or access controls.

---

## Phase 8 — AI Editor

Implement:

* Story summary
* Classification
* Confidence
* Rumor detection
* Final editorial text

---

## Phase 9 — Ranking

Implement:

* Global Top 10
* Argentina
* USA
* Europe
* Genre filtering

---

## Phase 10 — Output

Initial outputs:

```text
CLI
JSON API
```

Then optionally:

```text
Telegram
Email
Web dashboard
```

---

# 30. Testing Strategy

The project must use TDD where practical.

Tests should cover:

## Unit tests

* Source normalization
* Artist extraction
* Genre classification
* Region classification
* Score calculation
* Trend velocity
* TTL configuration
* Story clustering

## Integration tests

* RSS → normalized item
* Multiple sources → single story
* Story → trend score
* Trend → Top 10

## AI tests

AI outputs should be validated against schemas.

The application must never trust arbitrary LLM output.

Use structured responses and runtime validation.

---

# 31. Error Handling

A failed source must not stop the entire pipeline.

Example:

```text
Rolling Stone      ✓
Pitchfork          ✓
NME                ✓
Indie Hoy          ✗
YouTube            ✓
X                  ✓
```

The system continues operating.

Errors should be logged.

No failed source should invalidate the entire report.

---

# 32. Observability

The system should log:

```text
collection started
collection completed
items collected
items discarded
stories detected
stories merged
AI calls
AI failures
ranking completed
```

Example:

```text
[11:30] Collection started
[11:31] 143 items collected
[11:31] 121 valid items
[11:32] 37 candidate stories
[11:32] 19 duplicate stories merged
[11:33] 18 final stories
[11:33] Top 10 generated
```

---

# 33. Cost Control

The system must minimize unnecessary LLM calls.

Do NOT send every collected item directly to an LLM.

Preferred pipeline:

```text
Raw data
 ↓
Cheap deterministic filters
 ↓
Keyword/entity detection
 ↓
Similarity
 ↓
Candidate stories
 ↓
LLM
```

Only high-value or ambiguous cases should reach the expensive AI stage.

---

# 34. Privacy and Data Retention

The MVP should follow a minimal-retention principle.

The system should not permanently store third-party content.

Only temporary metadata required for trend detection should be stored.

Redis keys must expire automatically.

The system should store URLs rather than copying entire articles whenever possible.

---

# 35. Configuration

All important parameters must be configurable through environment variables or configuration files.

Examples:

```env
REDIS_URL=

LLM_PROVIDER=
LLM_MODEL=

NEWS_INTERVAL_MINUTES=15
YOUTUBE_INTERVAL_MINUTES=30
SOCIAL_INTERVAL_MINUTES=15

TREND_TTL_HOURS=24

TOP_NEWS_LIMIT=10
```

---

# 36. Future Features

These are NOT part of the MVP.

Potential future features:

* PostgreSQL
* Historical trend analysis
* Artist trend history
* Genre trend history
* Dashboard
* Charts
* Telegram bot
* Email newsletter
* Discord
* Slack
* Personalized music feeds
* "What should Mr Music talk about today?"
* Podcast preparation
* Automatic radio rundown
* Automatic show notes
* Artist monitoring
* Festival monitoring
* New album monitoring
* Argentina-only mode
* Rock-only mode
* Metal-only mode
* User-defined sources

---

# 37. Mr Music Integration

A future integration could produce:

```text
MR MUSIC DAILY BRIEF

🔥 TOP STORIES

1. ...
2. ...
3. ...

🇦🇷 ARGENTINA

1. ...
2. ...

🎸 ROCK

1. ...
2. ...

🤘 METAL

1. ...
2. ...

🎙️ POTENTIAL RADIO TOPICS

• ...
• ...
• ...
```

This feature should be implemented separately from the core intelligence engine.

The core system should remain generic.

---

# 38. MVP Definition of Done

The MVP is considered complete when:

* [ ] NestJS project works
* [ ] Redis works
* [ ] BullMQ works
* [ ] At least 5 news sources are operational
* [ ] Source adapters are generic
* [ ] News items are normalized
* [ ] Artists/entities are detected
* [ ] Duplicate stories are clustered
* [ ] Trend score is calculated
* [ ] Temporary state is stored in Redis
* [ ] Redis keys expire
* [ ] At least 2 YouTube channels are supported
* [ ] AI editor generates structured output
* [ ] Top 10 is generated
* [ ] Argentina / USA / Europe filtering works
* [ ] Tests cover the core logic
* [ ] No permanent article database exists
* [ ] A complete run can be executed from CLI

---

# 39. First Milestone

Do NOT implement social media initially.

The first working version should be:

```text
RSS / News
    ↓
Normalization
    ↓
Entity detection
    ↓
Story clustering
    ↓
Scoring
    ↓
AI summary
    ↓
TOP 10
```

With:

```text
NestJS
Redis
BullMQ
LLM
```

Once this works reliably, add:

```text
YouTube
```

and only afterwards:

```text
X
Instagram
TikTok
```

This keeps the project manageable and allows validating the core intelligence engine before dealing with the considerably more complex social-platform integrations.

---

# 40. Guiding Principle

The project is **not a news archive**.

It is a **real-time music intelligence system**.

Its primary question is:

> "What is happening in music right now, and what is gaining attention?"

The system should prioritize:

```text
RECENCY
+
RELEVANCE
+
VELOCITY
+
CROSS-SOURCE CONFIRMATION
+
CROSS-PLATFORM SIGNAL
```

while minimizing:

```text
STORAGE
DUPLICATION
LLM COST
NOISE
FALSE TRENDS
```

The architecture should remain modular so that new sources, platforms, genres, regions and AI providers can be added without rewriting the core system.
