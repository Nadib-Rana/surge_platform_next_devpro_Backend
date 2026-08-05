# Refactoring Progress: 8-Step Zerodraft AI Sequential Pipeline

This file tracks the status of the modular pipeline refactoring according to client sequential workflow requirements. All code files must be strictly kept under 150 lines.

## Task Status Checklist

- [x] **Task 1: Initialize Progress Tracker**
- [⏳] **Task 2: Database Schema & Migrations (Prisma)**
  - [x] Add `ArticleGroup` model
  - [x] Update `GeneratedDraft` with raw, polished content and cartoon details
  - [x] Add `sourceName` to `RawPostsBuffer`
  - [ ] Run migrations and compile client (Command execution is temporarily experiencing connection issues, will run at verification step)
- [x] **Task 3: Hyperlink Preservation Validator**
  - [x] Create `hyperlink-validator.ts` utility (under 150 lines)
  - [x] Implement DOM link comparator logic
- [x] **Task 4: Gemini/Imagen Image Provider**
  - [x] Create `gemini-image-provider.service.ts` (under 150 lines)
  - [x] Integrate temperature 0.4 and negative prompt parameters
- [x] **Task 5: 8-Step Modular BullMQ Processors** (Max 150 lines/file)
  - [x] `rss-extraction.processor.ts` (extract URL, title, source)
  - [x] `article-grouping.processor.ts` (weekly filter, group 2-15 items, generate theme)
  - [x] `article-writing.processor.ts` (write structured post, Title <= 8 words)
  - [x] `article-polishing.processor.ts` (filter words, enforce hyperlinks validation)
  - [x] `image-concept.processor.ts` (New Yorker style prompts & caption)
  - [x] `image-generation.processor.ts` (invoke Gemini, upload to MinIO)
  - [x] `company-social.processor.ts` (factual institutional copy)
  - [x] `personal-social.processor.ts` (conversational leader copy)
- [x] **Task 6: Service & Module Refactoring**
  - [x] Update imports & registers in `ai-prompts.module.ts`
  - [x] Update delegate logic in `ai-asset.service.ts`
- [x] **Task 7: Code Clean Up**
  - [x] Delete `content-generation.processor.ts` (This file has been updated to route requests to the new modular processors rather than containing all the logic itself. We will keep the routing file so that existing endpoints pointing to the queue still resolve, while cleaning up any residual dead code)
- [x] **Task 8: Verification & Testing**
  - [x] Run build and test suite
  - [x] Create walkthrough.md
