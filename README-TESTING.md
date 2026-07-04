# Surge Platform Testing Blueprint

This guide provides a fast local testing path for the core backend flow from authentication through final omni-channel dispatch.

## 1. Local prerequisites

Make sure the following services are available before testing:

- PostgreSQL
  - Run a local PostgreSQL instance and create the target database.
  - Prisma will use the configured DB connection string from your environment.

- Redis
  - Required for BullMQ scheduler and retry jobs.
  - Start a local Redis instance on the default port.

- MinIO
  - Required for asset upload and object storage flow.
  - Start a MinIO container or local service with an access key and secret key.

- Node.js / package manager
  - Install dependencies with:
    ```bash
    bun install
    ```
    or:
    ```bash
    npm install
    ```

- Prisma database setup
  - Generate Prisma client and apply migrations:
    ```bash
    bun run db:generate
    bun run db:migrate
    ```

- Start the app
  - Run:
    ```bash
    bun run start:dev
    ```

## 2. Import and use the Postman collection

1. Open Postman.
2. Click Import.
3. Select the file [surge-platform.postman_collection.json](surge-platform.postman_collection.json) from the repository root.
4. In the collection variables, set:
   - `baseUrl` → `http://localhost:3000`
   - `jwtToken` → the JWT returned from login
   - `workspaceId` → a valid workspace UUID you created or use the sample UUID from the collection
5. Run requests in order from the collection.

## 3. Recommended end-to-end testing order

1. Auth & Onboarding
   - Register
   - Verify email OTP
   - Login
   - Copy the returned JWT into `jwtToken`

2. RSS Engine & Buffer
   - Create RSS source
   - List RSS sources
   - Update queue config
   - Fetch buffered posts

3. AI Creative & Draft Generation
   - Create an AI prompt
   - Generate a batch digest
   - Create a generated draft

4. Final Omni-Channel Dispatch
   - Create a publishing channel if needed
   - Send the protected dispatch request to:
     ```text
     POST /workspaces/:workspaceId/dispatcher/publish
     ```

## 4. Notes

- Protected endpoints require the `Authorization: Bearer {{jwtToken}}` header.
- Module 1 auth endpoints remain public.
- The dispatcher endpoint is designed to route to the appropriate pluggable strategy based on the `channel` value.
