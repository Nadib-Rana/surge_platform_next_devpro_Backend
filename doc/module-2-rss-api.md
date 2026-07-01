Module 2 — Dynamic RSS Ingestion Engine API
===========================================

Overview
--------
This document describes the production-ready HTTP API for Module 2 (Dynamic RSS Ingestion Engine).

Base path: /workspaces/:workspaceId
Authentication: Bearer JWT in `Authorization` header (recommended `JwtAuthGuard` applied at route-level).

Environment variables
- REDIS_URL — BullMQ/Redis connection (default: redis://127.0.0.1:6379)

Notes
- All IDs in this system are UUID strings (Postgres native UUID via Prisma @db.Uuid).
- `queue_config` is stored as JSON inside the `Workspace` record.
- Jobs scheduled by the system carry a minimal, idempotent payload: `{ workspaceId, feedId, feedUrl }`.

Endpoints
---------

1) Create RSS Source

- Method: POST
- Path: /workspaces/:workspaceId/rss-sources
- Auth: Required
- Purpose: Register a new RSS feed for the workspace and register repeatable fetch job.

Request body (JSON): CreateRssSourceDto
{
  "feedUrl": "https://example.com/feed.xml",
  "description": "Optional human description"
}

Validation
- `feedUrl` must be a valid URL (http/https).

Behavior
- Check that `workspaceId` exists and belongs to a company.
- Lookup the company's subscription by `company.ownerId` → `Subscription.userId` and evaluate `tier`.
- Enforce tier limits:
  - starter: max 5 active feeds
  - pro: max 20 active feeds
  - business: max 50 active feeds
- On success create `RssFeed` row with `status = "active"` and call scheduler to create/update repeatable job using `workspace.queue_config.fetchFrequencyHours` (default 1 hour).

Success response (201 Created)
{
  "id": "<feed-uuid>",
  "workspaceId": "<workspace-uuid>",
  "feedUrl": "https://example.com/feed.xml",
  "status": "active",
  "createdAt": "2026-06-30T...Z"
}

Errors
- 400 Bad Request — invalid body
- 403 Forbidden — subscription limit reached
  {
    "success": false,
    "statusCode": 403,
    "message": "Your subscription tier (starter) allows maximum 5 active RSS feeds.",
    "code": "AUTHORIZATION_ERROR"
  }
- 404 Not Found — workspace not found

Example curl

```bash
curl -X POST "https://api.example.com/workspaces/11111111-2222-3333-4444-555555555555/rss-sources" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"feedUrl":"https://example.com/feed.xml","description":"Blog"}'
```

2) List active RSS Sources

- Method: GET
- Path: /workspaces/:workspaceId/rss-sources
- Auth: Required

Success response (200 OK)
[
  {
    "id": "<feed-uuid>",
    "workspaceId": "<workspace-uuid>",
    "feedUrl": "https://example.com/feed.xml",
    "status": "active",
    "createdAt": "2026-06-30T...Z"
  }
]

Errors
- 404 Not Found — workspace not found

3) Delete RSS Source (soft or hard)

- Method: DELETE
- Path: /workspaces/:workspaceId/rss-sources/:sourceId
- Auth: Required
- Query: `force=true` (optional) — when present does a hard delete; otherwise sets `status = "inactive"`.

Success (200 OK)
{
  "id": "<sourceId>",
  "deleted": true
}

Errors
- 404 Not Found — feed not found or not belonging to workspace

Scheduler & Job Payload
-----------------------
- Service: RssSchedulerService (registered under Workspaces module)
- Queue name: `rss-fetch-queue`
- Repeatable job payload (JSON):
  {
    "workspaceId": "<workspace-uuid>",
    "feedId": "<feed-uuid>",
    "feedUrl": "https://example.com/feed.xml"
  }
- Repeat schedule: `every = fetchFrequencyHours * 3600 * 1000` ms (default fetchFrequencyHours = 1)
- Job name: `rss:<workspaceId>:<feedId>` — scheduler removes existing repeatable entries with matching name or keys including `feedId` before adding new one.

Implementation notes / production checklist
-----------------------------------------
- Ensure `REDIS_URL` points to a well-monitored Redis cluster and set connection options (max retries, timeouts) in production.
- Add an authenticated RBAC guard ensuring the caller belongs to `workspaceId` (owner/admin/member) before allowing create/delete/patch.
- Add rate-limiting for POST endpoints to prevent abuse (e.g., `@nestjs/throttler`).
- Implement the worker that processes `rss-fetch-queue` jobs; it should:
  - Fetch feed, parse items
  - Compute `url_hash` (SHA-256) and deduplicate against `RawPostsBuffer.urlHash`
  - Insert unique items into `RawPostsBuffer` with `status = "buffered"`
- Add observability: metrics for scheduled jobs count, last-run timestamps, failures, retry counts.

Change log
----------
- v1: Initial production-ready API for Module 2 (create/list/delete feeds, update queue-config, scheduler behavior).

If you want I can also generate a Swagger (OpenAPI) spec from these DTOs and controllers, or implement the worker that handles `rss-fetch-queue` jobs next.
