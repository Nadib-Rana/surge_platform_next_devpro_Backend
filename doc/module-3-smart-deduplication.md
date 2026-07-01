# Module 3: Smart Deduplication & Raw Posts Buffer

## Status
Completed and production-ready.

## Endpoint: GET /workspaces/:workspaceId/buffer-posts

### Purpose
Returns buffered raw posts for a workspace from the last N days.

### Parameters
- workspaceId (path, required): Workspace UUID.
- days (query, optional): Historical window in days. Defaults to 3. Common values are 3 and 7.

### Example response
```json
{
  "data": [
    {
      "id": "0b6f0fe3-4b20-4f2d-97eb-ec3bc6b4f521",
      "workspaceId": "2db36ad1-1578-4d7f-a8e2-5dab6df6c485",
      "feedId": "4cbfd9d8-0f10-4ba6-9de8-0c2c7ddb2b15",
      "urlHash": "8d7c1b6d0c4c44e1f7d9f1a5e8f2d8a8b01f4a93ef5e16001a55b9f04a0d95c34",
      "title": "Example article",
      "rawContent": "<p>Article body</p>",
      "publishedAt": "2026-06-30T10:20:00.000Z",
      "status": "buffered"
    }
  ]
}
```

### Notes
- The service filters by workspaceId, status = buffered, and publishedAt >= now - N days.
- Results are ordered newest-first and capped at 100 rows.

## Worker architecture
The RSS worker listens to the rss-fetch-queue BullMQ queue and processes each job in this order:
1. Fetch the feed XML from the feed URL.
2. Parse items with rss-parser.
3. Derive a SHA-256 urlHash from the article link (or guid fallback).
4. Check the RawPostsBuffer table for that hash; if it already exists, skip the item.
5. If the item is new, insert it with status = buffered.
6. Update the parent feed's lastFetchedAt timestamp.

This keeps ingestion idempotent under retries, duplicate schedules, and repeated worker execution.
