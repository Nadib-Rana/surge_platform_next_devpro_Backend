
---

#  Surge Platform - Core Feature Progress Tracker
* [x] **Workspace RSS CRUD Controller:** প্রতিটি ওয়ার্কস্পেসের আন্ডারে আরএসএস ফিড যোগ, রিমুভ এবং ভিউ করার এন্ডপয়েন্ট তৈরি।
* [x] **Subscription Tier Guard Rail:** ইউজার যখনই নতুন ফিড এড করতে যাবে, তার কারেন্ট প্ল্যান টায়ার চেক করা (`starter`: 5, `pro`: 20, `business`: 50+) এবং লিমিট ক্রস করলে ব্লক করা।


* [x] **Customer-Controlled Fetch Frequency:** `Workspace` টেবিলের `queue_config (Json)` কলামে ইউজারের কাস্টম স্ক্র্যাপিং ফ্রিকোয়েন্সি (যেমন: প্রতি ১, ৬, বা ১২ ঘণ্টা) সেভ করা।

* [x] **Dynamic BullMQ Repeatable Jobs Scheduler:** ক্রন জবের ওপরে ক্লায়েন্টের চয়েস ইমপ্যাক্ট করানোর জন্য, ফ্রন্টএন্ড থেকে ফ্রিকোয়েন্সি চেঞ্জ হওয়া মাত্রই রেডিস কিউ ক্রন ডায়নামিকালি রিমুভ ও রি-রেজিস্টার করার মেকানিজম।


* [x] **Object Storage:** MinIO S3-Compatible Storage (Presigned URLs Architecture) implemented with a shared storage service, presigned upload/download endpoints, and AI asset uploads routed through the storage layer.


* [x] **AI Engine Layer:** Multi-Model Synthesis implemented with Claude and OpenAI-backed digest generation, DALL-E 3 image creation, and shared asset storage integration.


* **Subscription Core:** `starter` ($19), `pro` ($49), `business` ($99)



---

## 🟩 Module 1: Multi-Tenant SaaS Engine (Auth & Onboarding) `[STATUS: 100% COMPLETE]`

* [x] **Secure Registration Loop:** `bcryptjs` ব্যবহার করে পাসওয়ার্ড সিকিউর হ্যাশিং ও স্টোরেজ।


* [x] **2-Step OTP Verification:** ৬-ডিজিটের সাইন-আপ ওটিপি জেনারেশন এবং ডাটাবেজে `token_hash` (Bcrypt) মেকানিজমে সেভ করা।


* [x] **Password Rotation Safety:** `password_changed_at` টাইমস্ট্যাম্প ট্র্যাকিং, যা আপডেট হওয়া মাত্রই পুরনো সব একটিভ JWT টোকেন অটো-ইনভ্যালিড করে দেয়।


* [x] **Auto-Provisioning Event:** ইউজার ওটিপি সাকসেসফুলি ভেরিফাই করার সাথে সাথেই ব্যাকএন্ড ইভেন্ট ফায়ার হয়ে অটোমেটিক ১টি `Company` এবং ১টি ডিফল্ট `Workspace` জেনারেট হওয়া।


* [x] **Workspace Isolation & RBAC:** কমপ্লিট মাল্টি-টেন্যান্সি আইসোলেশন এবং রোল-বেসড অ্যাক্সেস কন্ট্রোল (Owner, Admin, Member) এস্টাবলিশমেন্ট।



---

## 🟩 Module 2: Dynamic RSS Ingestion Engine `[STATUS: 100% COMPLETE]`

* [x] **Workspace RSS CRUD Controller:** `POST /workspaces/:workspaceId/rss-sources`, `GET /workspaces/:workspaceId/rss-sources`, `DELETE /workspaces/:workspaceId/rss-sources/:sourceId` এন্ডপয়েন্ট তৈরি করা হয়েছে — প্রতিটি ফিড `workspaceId` দিয়ে লিংক থাকে এবং `status` ফিল্ড দিয়ে soft-delete সমর্থন করা হয়।

* [x] **Subscription Tier Guard Rail:** ওয়ার্কস্পেসের কোম্পানি-ওনারের সাবস্ক্রিপশন টায়ার অনুযায়ী লিমিট চেক করা হয় (starter=5, pro=20, business=50) — লিমিট অতিক্রম করলে `403 Forbidden` রিটার্ন করে।

* [x] **Customer-Controlled Fetch Frequency:** `PATCH /workspaces/:workspaceId/queue-config` এন্ডপয়েন্ট তৈরি করা হয়েছে; `queue_config` JSON-এ `{ fetchFrequencyHours, postingTimes }` সেভ হয় এবং ভ্যালিডেশন করা হয়।

* [x] **Dynamic BullMQ Repeatable Jobs Scheduler:** `RssSchedulerService` তৈরি করা হয়েছে — নতুন ফিড বা কনফিগ পরিবর্তনে পুরনো repeatable job রিমুভ করে নতুন `every`-based repeatable job রেজিস্টার করে; job payload এ `workspaceId`, `feedUrl`, `feedId` থাকে।

* [x] **Boot & Resilience:** অ্যাপ বুটে সক্রিয় সব ফিড স্ক্যান করে সংশ্লিষ্ট repeatable jobs নিশ্চিত করে; job নামকরণ ও repeatable-key হ্যান্ডলিং করা হয়েছে যাতে duplicate jobs না হয় এবং রিমোভাল নির্ভরযোগ্য হয়।

* [x] **Operational safeguards:** soft-delete (status='inactive') এর মাধ্যমে দ্রুত ডিকটিভেশন; hard-delete `force=true` অপশনে সমর্থন; subscription fallback default হিসেবে `starter` ধরা হয় যদি সাবস্ক্রিপশন রেকর্ড না পাওয়া যায়।



---

## 🟩 Module 3: Smart Deduplication & Raw Posts Buffer `[STATUS: 100% COMPLETE]`

* [x] **Idempotent Scraper Middleware:** আরএসএস ফিড স্ক্র্যাপ করার সময় আর্টিকেলের মেইন ইউআরএল-কে SHA-256 হ্যাশ করে `url_hash` বের করা।
* [x] **Database Unique Constraint Guard:** জেনারেট হওয়া `url_hash` ডাটাবেজের ইউনিক কলামের সাথে চেক করে ডুপ্লিকেট ডেটা হলে স্ক্র্যাপিং প্রসেস থেকে তাৎক্ষণিক স্কিপ করা।
* [x] **Raw Post Buffer Storage:** নতুন ইউনিক আর্টিকেলগুলোকে `status: "buffered"` ফ্ল্যাগ দিয়ে ইনজেস্ট করা।
* [x] **Historical Window Filter Logic:** প্রিজমার `published_at` ফিল্ডের ওপর `gte` (Greater Than or Equal) কুয়েরি চালিয়ে ড্যাশবোর্ডে গত ৩ দিন বা ৭ দিনের কাঁচা বাফারের ডেটা পুশ ও ফিল্টারিং লজিক।
* [x] **Production Readiness:** `GET /workspaces/:workspaceId/buffer-posts` এন্ডপয়েন্ট, BullMQ worker, এবং deduplication flow 100% complete এবং রেডি।



---

## 🟩 Module 4: AI Creative Engine & Asset Pipeline `[STATUS: 100% COMPLETE]`

* [x] **Prompt Version Control Matrix:** `AiPrompt` এবং `PromptVersion` টেবিল ডিজাইন ও আর্কিটেকচার, যা এআই প্রম্পটের হিস্ট্রি এবং টোন ট্র্যাক রাখবে।
* [x] **Strict Prompt Scope Architecture:** `PromptScope` (GLOBAL/WORKSPACE) এবং `createdById` ownership constraint দিয়ে prompt template access আলাদা করা হয়েছে। `GET /ai-prompts/global` শুধুমাত্র global template দেয়, `GET /ai-prompts/workspace` শুধুমাত্র logged-in user's own workspace template দেয়, এবং `GET /ai-prompts/:id` GLOBAL হলে allow করে কিন্তু অন্য tenant-এর WORKSPACE prompt হলে `404` দেয়।
* [x] **Atomic Prompt Version Update:** `PATCH /ai-prompts/global/:id` admin-only এবং `PATCH /ai-prompts/workspace/:id` owner-only করা হয়েছে। `name` / `description` parent prompt table-এ আপডেট হয়, আর `systemPrompt` বা `tone` বদলালে Prisma `$transaction` দিয়ে পুরনো version inactive করে নতুন active `PromptVersion` তৈরি হয়।
* [x] **Cross-Tenant Validation Note:** Batch digest generation এখনো `workspaceId` + `promptVersionId` payload নেয়; production hardening checklist-এ JWT authenticated workspace ownership এবং promptVersion/workspace compatibility validation বাধ্যতামূলক হিসেবে চিহ্নিত করা হয়েছে।


* [x] **Batch Digest Aggregator:** বাফারে থাকা একাধিক র-আর্টিকেলকে একসাথে কম্বাইন করে OpenAI/Claude text model-এ পাঠিয়ে ১টি trending "Batch Digest" social content তৈরি করা।


* [x] **API Throttling Guard (Anti-Lock):** এআই টেক্সট সফলভাবে জেনারেট হওয়ার ঠিক পর ৩ সেকেন্ডের একটি কৃত্তিম সেফটি ব্রেক বা `Delay` মেকানিজম রান করা, যেন রেট লিমিট বা আইপি ব্লক না হয়।


* [x] **Resilient DALL-E Asset Downloader:** DALL-E image generation `try/catch` দিয়ে hardened করা হয়েছে। OpenAI image API key restriction, model access failure, বা transient API/download failure হলে pipeline crash না করে structural fallback PNG buffer তৈরি করে MinIO-তে upload করে valid asset URL ফেরত দেয়।
* [x] **MinIO S3 Bucket Pipeline:** জেনারেটেড বা fallback image buffer নিজস্ব secure **MinIO Object Storage**-এ upload করা হয় এবং draft creation-এর জন্য secure presigned URL return করা হয়।
* [x] **Race Condition Patch:** `AiAssetService.generateImageFromDigest()` থেকে premature `generatedDraft.updateMany()` সরানো হয়েছে। এখন asset service শুধু image buffer -> MinIO upload -> presigned URL return করে; `GeneratedDraft` write একমাত্র `AiPromptsService.generateBatchDigest()` flow-তেই হয়, তাই draft তৈরি হওয়ার আগের image update race condition নেই।



---

## 🟩 Module 5 & 6: Autopilot Scheduler & Retries [STATUS: 100% COMPLETE]

* [x] **Autopilot Engine Sync:** কাস্টমার ড্যাশবোর্ড থেকে সিলেক্ট করা ডেইলি পোস্টিং শিডিউল (যেমন: প্রতিদিন সকাল ৯টা ও বিকাল ৫টা) `queue_config (Json)` থেকে রিড করা এবং BullMQ টাইম-ব্যাজড repeatable jobs হিসেবে সিঙ্ক করা।


* [x] **Draft-Targeted Dispatch Selection:** BullMQ job payload-এ `draftId` থাকলে worker এখন সেই নির্দিষ্ট `GeneratedDraft`-কেই publish candidate হিসেবে resolve করে। ফলে একই workspace-এ একাধিক approved/scheduled draft থাকলেও latest draft accidentally pick হওয়ার risk নেই।


* [x] **Module 4 Asset Compatibility:** Autopilot worker এখন `GeneratedDraft.imageUrl` এবং `imageProvider` dispatcher payload-এ forward করে। DALL-E generated asset বা resilient fallback PNG, দুই ক্ষেত্রেই MinIO presigned URL একই publish flow দিয়ে WordPress/LinkedIn/Facebook strategy-তে যায়।


* [x] **Idempotency Distributed Lock:** একাধিক ওয়ার্কার রান থাকলেও যেন একই কন্টেন্ট সোশ্যাল মিডিয়ায় ডাবল পাবলিশ না হয়, সেজন্য Redis TTL Lock (`autopilot-lock:<draftId>`) সক্রিয় করা হয়েছে। Lock release এখন compare-and-delete Lua script দিয়ে owner-safe করা হয়েছে, যেন slow worker TTL rollover-এর পর অন্য worker-এর নতুন lock delete করতে না পারে।


* [x] **FailedPostsQueue & Exponential Backoff:** থার্ড-পার্টি সোশ্যাল এপিআই ডাউন থাকলে কন্টেন্ট `FailedPostsQueue`-এ পাঠানো এবং BullMQ ব্যাকঅফ লজিক দিয়ে ৩টি অটো-রিট্রাই চালানো হয়েছে। Retry processor queue binding `FailedPostsQueue`-এর সাথে aligned করা হয়েছে, তাই failed publish jobs এখন correct worker-এ consume হবে।


* [x] **Dispatcher Boundary Integration:** Autopilot worker এখন direct publish simulation না করে `DispatcherService` boundary ব্যবহার করে। Channel credentials unreadable হলে fail-closed behaviour রাখা হয়েছে, যাতে invalid/encrypted credential state silent success না দেয় এবং retry pipeline activate হয়।



---

## 🟩 Module 7: Pluggable Omni-Channel Dispatcher [STATUS: 100% COMPLETE]

* [x] **Generic Core Dispatcher Architecture:** একটি বেস বা ইন্টারফেস সার্ভিস ডিজাইন করা, যাতে ডাটাবেজ স্কিমা টাচ না করেই যেকোনো নতুন ওমনি-চ্যানেল এপিআই প্লাগ-ইন করা যায়।
* [x] **WordPress Rest API Engine:** কাস্টমারের নিজস্ব ওয়ার্ডপ্রেস ব্লগে ফরম্যাটেড কন্টেন্ট ও ফিচারড ইমেজ অটো-পাবলিশিং।
* [x] **LinkedIn Graph API Engine:** কাস্টমারের পার্সোনাল প্রোফাইল বা কোম্পানির অফিসিয়াল পেজে কন্টেন্ট ডিসপ্যাচ।
* [x] **Facebook Graph API Engine:** ফেসবুক বিজনেস পেজ এবং গ্রুপে কন্টেন্ট এবং ইমেজ পুশ করার সাপোর্ট।
* [x] **Future Channel Extensibility:** ফিউচারে কাস্টমারের ডিমান্ড অনুযায়ী X (Twitter), Instagram বা Threads-এর অফিশিয়াল SDK মাত্র ১টি ফাইলে এক্সটেন্ড করার সুবিধা রাখা।

---

## 🟩 Module 8: Human Review & Manual Publishing System [STATUS: 100% COMPLETE]

* [x] **Auto-Post Mode Toggle:** `PATCH /workspaces/:workspaceId/queue-config` এ `autoPost` যোগ করা হয়েছে, যাতে workspace-level review mode এবং direct publish mode switch করা যায়।
* [x] **Review-First Draft Lifecycle:** `GeneratedDraft` এখন `draft`, `review`, `approved`, `scheduled`, `published`, `rejected`, `failed`, `deleted`, `auto_dispatch` lifecycle সাপোর্ট করে এবং `editorState`-এ title / excerpt / slug / hashtags / SEO metadata রাখা হয়।
* [x] **Manual Review APIs:** generated draft list, details, edit, approve, reject এবং soft-delete flow চালু করা হয়েছে JWT-authenticated workspace access control সহ।
* [x] **Publish Now & Schedule Publish:** immediate publish এবং scheduled publish endpoints যোগ হয়েছে, যেখানে selected publishing channels resolve হয়ে DispatcherService boundary দিয়ে dispatch হয়।
* [x] **Permissions & Audit Log:** owner/admin/member workspace checks, manage-draft permission guard, এবং `SystemLog`-এ create/edit/publish/schedule/review audit trail রেকর্ড করা হয়।
* [x] **Swagger, Postman & Tests:** Swagger docs bootstrap করা হয়েছে, Postman collection-এ Module 8 flow যোগ করা হয়েছে, এবং generated-drafts service/controller unit tests green করা হয়েছে।

---
