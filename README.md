# Music Intelligence Agent

Real-time music-news intelligence agent. It collects music stories from
multiple sources, clusters duplicate coverage of the same event into a single
story, scores trends, and produces a Top 10 of what's being discussed right
now across Argentina, the USA and Europe.

This is **not** a news archive: raw articles/posts are never persisted.
Redis holds only temporary trend state (topic, source count, velocity,
score...), and every key expires automatically.

Status: **first milestone (spec section 39) minus the AI summary.** RSS
collection from 19 outlets, normalization, entity detection, story
clustering, trend scoring and ranking all run; the AI editor (spec 20),
YouTube (Phase 6) and social sources (Phase 7) are not implemented yet.
See [PROJECT_SPEC.md](PROJECT_SPEC.md) for the full spec.

## Stack

- NestJS + TypeScript
- Redis (Redis Stack, for future vector-similarity clustering) + BullMQ
- Jest for tests

## Prerequisites

- Node.js 20+
- Docker Desktop (for the local Redis container) — or any Redis instance
  you point `REDIS_URL` at

## Setup

```bash
npm install
cp .env.example .env
```

Start Redis:

```bash
docker compose up -d
```

This starts Redis Stack on `localhost:6381` (mapped from the container's
6379, to avoid clashing with Redis instances other local projects may have
on the default port). `.env.example` already points `REDIS_URL` at 6381 —
change both if you need a different port.

## Running

```bash
npm run start:dev    # watch mode
npm run start        # single run
npm run build && npm run start:prod
```

Once running, check the app can reach Redis:

```bash
curl http://localhost:3000/health
# {"status":"ok","redis":"ok"}
```

## Getting the news

The API runs the pipeline on start (if Redis has no ranking yet) and then
every `NEWS_INTERVAL_MINUTES` via a BullMQ job scheduler. To run it by hand:

```bash
npm run refresh             # full run: collect → … → rank, prints the Top 10
npm run music-intelligence  # same as refresh
npm run top                 # print the current ranking without re-running
```

API (spec section 27):

| Endpoint | |
|---|---|
| `GET /api/news/top` | Global Top 10 |
| `GET /api/news/top?region=argentina|usa|europe` | Regional Top 10 |
| `GET /api/news/top?genre=rock` | Genre Top 10 (combinable with `region`) |
| `GET /api/trends` | Every ranked candidate (up to 60) |
| `POST /api/news/refresh` | Run the pipeline now |

Sources are configured in `src/sources/news-sources.config.ts` (feed URL,
region, authority, default genres, enabled). Feeds that currently fail are
kept there disabled, with a note saying why.

## Frontend (Top 10 UI)

A Next.js app in `frontend/` shows the ranking with a region filter. It
shares the visual design of the custom-tshirt frontend (white/red/black,
Inter, Tailwind 4).

```bash
npm run start:dev         # API on :3000

cd frontend
npm install
cp .env.example .env.local   # REDIS_URL of the same Redis
npm run dev               # UI on http://localhost:3001
```

The frontend reads the ranking from Redis through its own `app/api/*`
routes, so it doesn't need the Nest API running - only a Redis that the
pipeline has written to.

## Deploy (Vercel + Upstash + GitHub Actions)

Production has no always-on server:

```
GitHub Actions (3×/day) ──npm run refresh──▶ Upstash Redis ◀──read── Vercel (frontend/)
```

- **Pipeline:** `.github/workflows/refresh.yml` runs `npm run refresh` at 09:00,
  15:00 and 21:00 Argentina time, plus manual runs from the Actions tab and
  from the site's **Actualizar** button. It is the only writer.
  GitHub may start scheduled runs a few minutes late.
- **Actualizar button:** `POST /api/refresh` (in `frontend/`) starts the
  workflow through GitHub's `workflow_dispatch` API, then the page polls
  until the new ranking lands (~1-2 min). Anyone can press it, so a shared
  cooldown in Redis (`music:refresh-lock`, `REFRESH_COOLDOWN_MINUTES`,
  default 30) allows at most one visitor-triggered run per window.
- **Redis:** an Upstash database (free plan). The pipeline only uses plain
  Redis commands; BullMQ is loaded only by the local dev server.
- **Web:** the Next.js app in `frontend/` serves the UI and a read-only API
  (`/api/news/top`, `/api/trends`, `/api/health`) that reads Redis directly.

Setup:

1. Create a Redis database on [Upstash](https://upstash.com) and copy its
   `rediss://…` connection string.
2. On GitHub: *Settings → Secrets and variables → Actions → New repository
   secret* → `REDIS_URL` = that string. Then run the workflow once from the
   *Actions* tab to fill Redis.
3. On Vercel: import the repo, set **Root Directory** to `frontend`, and add
   the environment variable `REDIS_URL` (same string).
4. For the **Actualizar** button: on GitHub, *Settings → Developer settings →
   Personal access tokens → Fine-grained tokens → Generate new token*, with
   access to this repository only and the permission *Actions: Read and
   write*. On Vercel add `GITHUB_DISPATCH_TOKEN` (that token) and
   `GITHUB_REPO` (`owner/repo`), then redeploy. Without them the button
   answers "No pudimos pedir la actualización" and the rest of the site
   keeps working.

Don't point a local `npm run start:dev` at the Upstash URL: the dev server's
scheduler runs every `NEWS_INTERVAL_MINUTES` and would break the 3-a-day cap.

## Testing

```bash
npm test          # unit tests (mocked Redis, no infra needed)
npm run test:cov  # unit tests with coverage
npm run test:e2e  # e2e tests — requires Redis running (docker compose up -d)
```

## Configuration

All runtime parameters are environment variables (see `.env.example`):

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6381` |
| `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY` | AI Editor provider (not wired up yet) | — |
| `NEWS_INTERVAL_MINUTES` | RSS/news polling cadence | `15` |
| `NEWS_MAX_AGE_HOURS` | Ignore older items; also the clustering time window | `48` |
| `FRONTEND_URL` | Origin allowed by CORS | `http://localhost:3001` |
| `YOUTUBE_INTERVAL_MINUTES` | YouTube polling cadence | `30` |
| `SOCIAL_INTERVAL_MINUTES` | Social polling cadence | `15` |
| `TREND_TTL_HOURS` | How long trend state lives in Redis | `24` |
| `SEEN_ITEM_TTL_HOURS` | Dedup window for re-polled items | `48` |
| `TOP_NEWS_LIMIT` | Size of the final ranking | `10` |
| `YOUTUBE_API_KEY` | YouTube Data API key (Phase 6) | — |

Scoring weights (spec section 17) live in `src/config/scoring-weights.ts`,
not in environment variables — they're structural, not per-environment.

## Project layout

```
src/
  config/          env + scoring-weight configuration
  common/
    enums/         Region, Genre, StoryType, VerificationStatus
    interfaces/    SourceItem, SourceAdapter, SocialSignal, TopStory contracts
  sources/         RSS source list, RssAdapter, CollectorService
  processing/      normalization, entity/type/genre detection, story clustering
  trends/          scoring, story building, ranking/filtering
  pipeline/        PipelineService (full run) + BullMQ worker/scheduler
  news/            /api/news/* and /api/trends
  redis/           Redis client + TrendStoreService (velocity samples, ranking snapshot)
  queues/          BullMQ queue registration
  health/          GET /health
  cli.ts           npm run refresh | top
frontend/          Next.js Top 10 UI
```

## Known design decisions (see project discussion for full rationale)

- Social platform adapters (X/Instagram/TikTok) ship as stubs until API
  budget is approved — the interfaces exist, the implementations don't.
- YouTube uses the official Data API only (uploads-playlist polling, no
  transcript scraping).
- BullMQ: for the first milestone the whole pipeline runs as one job on the
  `source-collection` queue; news volume doesn't justify per-stage queues
  (spec 25) yet.
- Entity detection and clustering are deterministic heuristics (outlet tags,
  headline subject, keyword similarity, time window), per spec 33. The AI
  editor will refine ambiguous cases once it exists.
- Raw items live only in memory during a run. Redis gets the ranked snapshot
  and per-story velocity samples, both with TTL.
- Redis Stack (not plain Redis) is used so the future clustering stage has
  vector search available without introducing Postgres.
