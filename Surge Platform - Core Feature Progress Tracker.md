
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
* [x] **Prompt Version Control Matrix:** Upgraded to an explicit dual-tier tracking engine. Integrated `PromptScope` (GLOBAL/WORKSPACE) enums alongside `createdById` user-ownership constraints to prevent cross-tenant token leaks, and patched `AiPromptService` with an idempotent OR-lookup query for unified template discovery.


* [x] **Batch Digest Aggregator:** বাফারে থাকা একাধিক র-আর্টিকেলকে একসাথে কম্বাইন করে OpenAI API-তে পাঠিয়ে ১টি ট্রেন্ডিং "Batch Digest" সোশ্যাল মিডিয়া কন্টেন্ট ও টেক্সট রেডি করা।


* [x] **API Throttling Guard (Anti-Lock):** এআই টেক্সট সফলভাবে জেনারেট হওয়ার ঠিক পর ৩ সেকেন্ডের একটি কৃত্তিম সেফটি ব্রেক বা `Delay` মেকানিজম রান করা, যেন রেট লিমিট বা আইপি ব্লক না হয়।


* [x] **DALL-E 3 Asset Downloader:** সোশ্যাল মিডিয়া কন্টেন্টের জন্য OpenAI DALL-E 3 দিয়ে হাই-কোয়ালিটি ইমেজ জেনারেট করা।
* [x] **MinIO S3 Bucket Pipeline:** জেনারেট হওয়া ইমেজ ওয়ান-টাইম ডাউনলোড করে নিজস্ব সিকিউর **MinIO Object Storage**-এ পুশ করা এবং ড্রাফটে সেভ করার জন্য সিকিউর প্রিসাইন্ড ইউআরএল (Presigned URL) জেনারেট করা।



---

## 🟩 Module 5 & 6: Autopilot Scheduler & Retries [STATUS: 100% COMPLETE]

* [x] **Autopilot Engine Sync:** কাস্টমার ড্যাশবোর্ড থেকে সিলেক্ট করা ডেইলি পোস্টিং শিডিউল (যেমন: প্রতিদিন সকাল ৯টা ও বিকাল ৫টা) `queue_config (Json)` থেকে রিড করা এবং BullMQ টাইম-ব্যাজড repeatable jobs হিসেবে সিঙ্ক করা।


* [x] **Idempotency Distributed Lock:** একাধিক ওয়ার্কার রান থাকলেও যেন একই কন্টেন্ট সোশ্যাল মিডিয়ায় ডাবল পাবলিশ না হয়, সেজন্য Redis TTL Lock (`autopilot-lock:<draftId>`) সক্রিয় করা হয়েছে।


* [x] **FailedPostsQueue & Exponential Backoff:** থার্ড-পার্টি সোশ্যাল এপিআই ডাউন থাকলে কন্টেন্ট `FailedPostsQueue`-এ পাঠানো এবং BullMQ ব্যাকঅফ লজিক দিয়ে ৩টি অটো-রিট্রাই চালানো হয়েছে।



---

## 🟩 Module 7: Pluggable Omni-Channel Dispatcher [STATUS: 100% COMPLETE]

* [x] **Generic Core Dispatcher Architecture:** একটি বেস বা ইন্টারফেস সার্ভিস ডিজাইন করা, যাতে ডাটাবেজ স্কিমা টাচ না করেই যেকোনো নতুন ওমনি-চ্যানেল এপিআই প্লাগ-ইন করা যায়।
* [x] **WordPress Rest API Engine:** কাস্টমারের নিজস্ব ওয়ার্ডপ্রেস ব্লগে ফরম্যাটেড কন্টেন্ট ও ফিচারড ইমেজ অটো-পাবলিশিং।
* [x] **LinkedIn Graph API Engine:** কাস্টমারের পার্সোনাল প্রোফাইল বা কোম্পানির অফিসিয়াল পেজে কন্টেন্ট ডিসপ্যাচ।
* [x] **Facebook Graph API Engine:** ফেসবুক বিজনেস পেজ এবং গ্রুপে কন্টেন্ট এবং ইমেজ পুশ করার সাপোর্ট।
* [x] **Future Channel Extensibility:** ফিউচারে কাস্টমারের ডিমান্ড অনুযায়ী X (Twitter), Instagram বা Threads-এর অফিশিয়াল SDK মাত্র ১টি ফাইলে এক্সটেন্ড করার সুবিধা রাখা।

---
