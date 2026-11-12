# 🤖 AI Automation Portfolio — n8n + LLM Production Pipelines

> Ten production-tested AI automation pipelines built with n8n-as-code — intelligent document processing, WhatsApp lead CRM, email triage with sentiment detection, live operations dashboards, AI-assisted insurance underwriting, a complete **recruitment funnel: CV screening → interview scheduling**, a **RAG knowledge base chatbot with hand-rolled vector search**, and a **natural-language analytics agent (AI plans, deterministic code executes)**.

**Author:** Hasan Akhtar — AI & Digital Growth Specialist · Doha, Qatar · 15+ years across automation, sales, insurance underwriting, and finance

---

## 📦 What's In This Repo

| # | Project | What It Does | Live Test Result |
|---|---------|--------------|------------------|
| 1 | **[AI Invoice Extractor (IDP)](#1-ai-invoice-extractor--intelligent-document-processing)** | Extracts 15+ fields from raw invoice text, validates tax math & dates, flags errors before payment | Caught a planted **325 QAR overcharge** (subtotal+tax ≠ total) |
| 2 | **[WhatsApp Lead CRM](#2-whatsapp-lead-crm)** | Parses native Meta webhook payloads, scores leads, upserts CRM by phone, queues auto-replies | Hot lead scored **9/10**, follow-up recognized on same contact, crypto spam filtered |
| 3 | **[Email Triage & Sentiment Agent](#3-email-triage--sentiment-agent)** | Auto-tags urgency, sentiment & spam on inbound messages; escalates angry customers with SLA | Legal-threat email → `URGENT / angry (-0.9)` → 15-min SLA alert + calm draft reply |
| 4 | **[Live Ops Dashboard API](#4-live-ops-dashboard)** | Aggregates KPIs from all pipelines into a real-time dashboard with health monitoring | Serves live validity/escalation/auto-settle rates via GET API |
| 5 | **[Insurance Claim Intake Bot](#5-insurance-claim-intake-bot)** | AI claim extraction + deterministic underwriting rules: coverage matrix, fraud scoring, 4-tier routing | 3 scenarios: auto-settle ✅ · coverage mismatch caught ✅ · fraud score 5 → SIU ✅ |
| 6 | **[Restaurant AI Receptionist](#6-restaurant-ai-receptionist)** | Two-workflow chat system: AI receptionist with memory + kitchen API that validates items, prices with VAT 5% and emails invoices | Off-menu item refused with suggestions ✅ · 77.70 QAR order confirmed, invoice emailed ✅ |
| 7 | **[CV Screening & Ranking Bot](#7-cv-screening--ranking-bot)** | Recruitment intake form: PDF CV text extraction → LLM match score (0–100), verdict, strengths/gaps/red flags → Google Sheets ranking log | 3-page PDF CV parsed → scored & logged to `CV_Screening_Log` ✅ · retry-on-fail against provider rate limits ✅ |
| 8 | **[Interview Scheduler](#8-interview-scheduler)** | Deterministic slot engine (Sun–Thu, Doha hours): books first free slot, prevents double-booking, Gmail invite with Add-to-Calendar, waitlist fallback | Booking #1 → `Sun 10:00` ✅ · Booking #2 auto-shifted to `11:00` (double-booking blocked) ✅ · invite emailed ✅ |
| 9 | **[RAG Knowledge Base Chatbot](#9-rag-knowledge-base-chatbot)** | Document upload → chunker → Ollama embeddings → cosine vector search in code → Groq grounded answer with citations; refuses when coverage is missing | Remote-work question → "2 days/week, line manager approves" ✅ · France question → refused (`no_match`) ✅ · tunnel test 200 OK ✅ |
| 10 | **[Ask Your Data — NL Analytics Agent](#10-ask-your-data--nl-analytics-agent)** | Plain-English question over a spreadsheet → Groq query plan (strict JSON) → deterministic whitelist validation → pure-JS execution engine → grounded answer; LLM never sees the raw data | Delivered revenue **113,445 QAR** (21/30 rows) ✅ · France question → deterministic `plan_rejected` ✅ · tunnel 200 OK ✅ |

Every workflow is written as code (`.workflow.ts` via **n8n-as-code**), versionable in Git, and deployed to a live n8n instance.

---

## 🧾 Project Case Studies

### 1. AI Invoice Extractor — Intelligent Document Processing

**Problem:** Manual invoice data entry costs 3–5 minutes per document; tax errors and overcharges slip through.

**Solution:** Webhook intake → Mistral AI extraction (temperature 0.1) → deterministic finance validation engine → Google Sheets audit log → Mattermost alerts for flagged invoices.

**Validation rules:** required fields · subtotal + tax = total (1% tolerance) · line-items sum vs subtotal · due date ≥ invoice date · optional-field transparency flags.

**Live test evidence:**
- Clean QAR invoice: all fields extracted, math verified (20,000 + 1,000 = 21,000), zero flags → status `valid`
- Planted-error invoice: `MATH_MISMATCH` caught (7,500 + 375 = 7,875 ≠ stated 8,200) + impossible due date → status `needs_review` + reviewer alert

### 2. WhatsApp Lead CRM

**Problem:** WhatsApp leads arrive 24/7; manual CRM entry means slow responses and duplicate contacts.

**Solution:** Native **Meta webhook payload parser** (`entry[].changes[].value.messages[]`) → AI lead intelligence (intent, budget/timeline/quantity signals, 1–10 score) → CRM **upsert keyed on phone number** (repeat contacts update, never duplicate) → **outbox-pattern** reply queue with culturally-aware auto-replies (e.g. "Waalaikum asalam! ✨") → spam filter.

**Live test evidence:**
- Hot lead (25 desks, 18k QAR budget, West Bay): `QUALIFIED 9/10`, reply queued
- Same-phone follow-up: recognized, context-aware reply, single CRM row
- Crypto spam: `SPAM`, no reply drafted or queued

**Production path:** swap intake webhook for the official WhatsApp Trigger node — pipeline unchanged.

### 3. Email Triage & Sentiment Agent

**Problem:** Inbound emails/chats pile up; angry high-value customers wait in the same queue as newsletters.

**Solution:** Universal intake (email/WhatsApp/chat/form) → AI classification (category, urgency, sentiment −1..+1, priority 1–10, key entities) → SLA routing (critical = 15 min) → auto-drafted replies (calm for angry, keen for sales, **none for spam by design**).

**Live test evidence:**
- "THIRD delay… legal team" email → `URGENT / critical / angry (-0.9) / 9-10` → Mattermost escalation + professional de-escalation draft
- Quotation inquiry → `SALES_INQUIRY / neutral / 5-10`, warm draft, no false alarm
- Lottery scam → `SPAM`, `draft_reply: null`

### 4. Live Ops Dashboard

**Problem:** Automation without visibility = no trust; stakeholders want to *see* it working.

**Solution:** GET API endpoint reads all pipeline logs from Google Sheets, computes live KPIs (invoice validity rate, triage escalation rate, claim auto-settle rate, handled value), returns structured JSON. The companion HTML dashboard auto-refreshes every 15s with a health banner that diagnoses data-source failures with fix instructions.

**Engineering detail:** read nodes are error-tolerant; the aggregator distinguishes `ok / empty / error` per source and never lets a dead sheet break the API.

### 5. Insurance Claim Intake Bot

**Problem:** Claim intake is slow and inconsistent; fraud signals get missed in manual review.

**Solution:** Hybrid AI + rules architecture — **AI extracts facts only** (claim type, fraud indicators, loss band); a **deterministic code rules engine decides** (auditable, AI never authorizes payouts):
- Coverage matrix (policy type × claim type)
- Fraud scoring: AI indicators + late-reporting rule (>30 days = +2)
- 4-tier routing: auto-settle (≤ QAR 2k, zero indicators) → fast-track (≤ 10k) → underwriter review → Special Investigation Unit
- Deterministic claimant notification templates per tier + SLA + documents checklist

**Live test evidence:**
- Clean QAR 1,450 motor claim → **auto-settle**, 24h SLA
- Fire claim on motor policy → `COVERAGE_MISMATCH` → underwriter
- 75-day-late claim, no police report, no photos, pressure tactics, serial claimant → **fraud score 5 → SIU**

---

### 6. Restaurant AI Receptionist

**Problem:** Restaurant customers message at all hours; order details, pricing and replies depend on someone being at the counter.

**Solution:** Two workflows in conversation. The receptionist agent (Mistral, per-customer memory) takes orders in chat; a kitchen API validates every item against a code-defined menu, prices with 5% VAT, generates the invoice email and refuses anything off the menu with suggestions.

**Live test evidence:**
- 2 Chicken Mandi + Fattoush Salad: confirmed at **77.70 QAR**, invoice emailed (order ORD-MVXD69WD)
- Pepperoni pizza (not on the menu): refused, closest items suggested
- "3 pepsi": mapped to Soft Drinks, quantity confirmed before submission

---

### 7. CV Screening & Ranking Bot

**Problem:** Screening CVs against job descriptions is manual, inconsistent, and untracked — every recruiter scores differently and nothing is logged.

**Solution:** n8n Form intake (candidate details + JD + PDF CV upload) → native PDF text extraction → Groq `gpt-oss-120b` agent (temperature 0.2) with a strict JSON contract → deterministic parser/validator code node → Google Sheets ranking log.

**Output schema per candidate:** `match_score` (0–100) · `verdict` (Strong/Good/Partial/Poor Match) · `experience_years` · `summary` · `key_strengths` · `skill_gaps` · `notable_red_flags` · `recommended_next_step`

**Engineering detail:**
- **Rate-limit resilience** — agent node retries 3× with 5s backoff after live testing surfaced provider 429s (Mistral) and model decommissioning (Groq Llama models) — the final model choice (`openai/gpt-oss-120b`) was verified directly against the provider's live model list
- **Side-branch sheet bootstrap** — the log sheet is auto-created by a parallel `onError: continue` node, keeping the data path (parser → append) clean of API-response noise
- **Strict JSON contract** — parser strips markdown fences and recovers the JSON object even when the model adds prose

**Live test evidence:**
- 3-page PDF CV (Word-produced) → full text extracted → scored with verdict, strengths and gaps → appended to `CV_Screening_Log` ✅
- Same form re-run after provider failure → auto-retry succeeded without manual intervention ✅

---

### 8. Interview Scheduler

**Problem:** After screening, coordinating interview times is email ping-pong — slots get double-booked, confirmations get lost.

**Solution:** Webhook intake (`{ name, email, role }`) → **deterministic slot engine** (code, not AI): Qatar work week Sun–Thu, fixed Doha-hours slots, skips slots already booked in the `Interview_Schedule` sheet → books the earliest free slot → Gmail confirmation with a one-click **Add to Google Calendar** link → JSON result with alternates.

**Scheduling rules (all in auditable code):**
- Work week: Sunday–Thursday (Qatar) · Slots: 10:00 / 11:00 / 14:00 / 15:00 GMT+3 · 45-minute duration · 14-day horizon
- Double-booking prevention: a booked start time is never offered again
- Fully booked → polite **waitlist** email instead of a broken booking
- Availability is one `CONFIG` object in the code node — no re-engineering to change hours

**Engineering detail:**
- Sheet bootstrap runs on a **side branch** (`onError: continue`) so the booking data path never sees sheet-API noise — same pattern as the CV bot
- Webhook v2 payloads nest JSON under `body` — intake node normalizes both shapes

**Live test evidence:**
- Booking #1 (Thursday): first working day correctly resolved to **Sunday 10:00** ✅
- Booking #2: slot **auto-shifted to 11:00** — double-booking blocked ✅
- Confirmation email delivered with working calendar link (`email_sent: true`) ✅

**Part of the recruitment funnel:** CV Screening Bot scores candidates → this scheduler books the interview — the same sheet workbook holds both logs.

---

### 9. RAG Knowledge Base Chatbot

**Problem:** Company knowledge lives in documents nobody can search at 2am; generic chatbots hallucinate because they answer from the whole internet instead of your facts.

**Solution:** A full **RAG (Retrieval-Augmented Generation) pipeline built from scratch — no vector database**:
- **Ingest:** browser form (text area + optional PDF, native PDF extraction) *or* programmatic API (`POST { title, type, text }`) → deterministic chunker (900 chars, 120 overlap, sentence-aware breaks) → **Ollama `nomic-embed-text` embeddings (768-dim, fully local & free)** → Google Sheets `KB_Chunks` tab as the vector store
- **Query:** `POST { question }` → embed the question → **cosine similarity computed in an auditable code node** over every stored chunk (topK 4, minScore 0.3) → Groq `gpt-oss-120b` (temperature 0.2) answers **strictly from the retrieved context** with `[1]`-style citations → **refuses with a fixed phrase when coverage is missing**

**Engineering detail:**
- **RAG without a vector DB** — every similarity score is reproducible from the stored embedding; swap in Pinecone/pgvector later without touching the retrieval contract
- **Grounding defense-in-depth** — even weak matches above minScore go to the LLM, which is instructed to refuse ungrounded questions; the France test proved it
- **Per-item code mode discipline** — the chunk-row builder maps `$('Chunk Document').all() × $input.all()` with a count-mismatch guard (a "run once for all items" collapse bug was caught and fixed in live testing)
- **Dual ingest** — the same chunker accepts the browser form and the flat API webhook; PDF upload wins when both text and file are provided
- **Side-branch sheet bootstrap** — same `onError: continue` pattern as the other pipelines

**Live test evidence:**
- Resignation notice → "**30 days written notice**, or forfeit one month's basic salary [1]" ✅
- Remote work → "**two days per week**, approved by the line manager after six months [1]" ✅
- Multi-document query (Services Guide) → "extraction confidence below **90 percent** routes to human review [1]" with `chunks_searched: 5` across 2 documents ✅
- "What is the capital of France?" → **"This is not covered in the knowledge base yet."** (refusal, not hallucination) ✅
- Public tunnel query → 200 OK with full sources + similarity scores ✅

---

### 10. Ask Your Data — NL Analytics Agent

**Problem:** Business users want answers from their spreadsheets ("what's our revenue?", "who owes the most?") without writing formulas — but a raw NL2SQL agent that lets the LLM compute or fetch data is a hallucination risk: wrong sums, invented rows, queries that leak the dataset.

**Solution:** A natural-language analytics agent where **the AI only plans, and code decides**:
- **Intake:** `POST /webhook/ask-data { question }` → Google Sheets `Sales_Orders` load (30 rows, Sep–Nov 2026)
- **Schema catalog (code):** infers field types, normalizes values, and attaches **schema-linking metadata** — field descriptions (`FIELD_DOCS`), real `date_range` min/max for date fields, `distinct_values` for string fields. **The LLM never sees a raw data row — only this catalog.**
- **Planner (Groq `gpt-oss-120b`, temp 0.1, `response_format: json_object`):** emits ONE strict JSON query plan — filters / group_by / aggregate / sort / limit / select — or `{"unanswerable": true, "reason": ...}` for questions outside the dataset
- **Validator (code):** whitelists every field, operator and value against the catalog; honors the planner's `unanswerable` verdict; anything unparseable or out-of-contract is rejected **deterministically** — it never reaches the executor
- **Executor (code):** a pure deterministic JS engine — filter → group → aggregate (sum/avg/min/max/count) → sort → limit → select. **Every number in the final answer comes from here, not from the LLM.**
- **Phraser (Groq, temp 0.2):** explains the computed result in natural business English, grounded strictly on the executor's numbers

**Engineering detail:**
- **NL2SQL-style schema linking** — the first "Ayesha Khan in October" test returned 0 rows because the planner mapped her to `customer` instead of `rep`; adding field descriptions + distinct_values to the catalog fixed it (4 orders, correct `rep` filter)
- **Real date ranges in the catalog** — before this, "orders in November" planned `2023-11-01` and counted 0; with `date_range: ["2026-09-02", "2026-11-08"]` the planner uses the actual years
- **Deterministic refusal (data-side)** — the RAG bot refuses when knowledge is missing; this agent refuses when the *question* doesn't map onto the schema: "What is the capital of France?" → `plan_rejected` with the planner's reason, zero LLM phrasing
- **Full transparency** — every response carries the executed plan, result rows, `rows_scanned`/`rows_matched` telemetry and the engine stack, so an auditor can recompute the answer from the plan alone

**Live test evidence (9-question suite, all ✅):**
- "Total revenue across all delivered orders" → **113,445 QAR**, plan `status eq Delivered + sum(total_qar)`, 21/30 rows matched ✅
- "Top 3 customers by revenue" → Qatar Logistics **49,225**, Gulf Hospitality 31,810, Al Mana Retail 26,560 ✅
- "Pending orders above 5000 QAR" → 3 orders (SO-1015, SO-1028, SO-1010) with multi-filter + column select ✅
- "Average order value per sales rep" → 6,024 / 5,600.5 / 4,626 per rep ✅
- "Orders in November" → count **3** inside the real 2026 date range ✅
- "Orders from Ayesha Khan in October" → `rep` filter (schema linking) + 4 orders ✅
- "What is the capital of France?" → **deterministic `plan_rejected`** ✅
- Public tunnel query → 200 OK, 113,445 verified ✅

---

## 🏗️ Shared Architecture

```
                    ┌──────────────────────────────────────────┐
                    │        n8n (as-code, Git-versioned)      │
                    └──────────────────────────────────────────┘
  intake (webhook) ─▶ AI Agent (Mistral, strict JSON, low temp)
                        │
                        ▼
                deterministic rules engine (code nodes)
                        │
        ┌───────────────┼───────────────────┐
        ▼               ▼                   ▼
  Google Sheets     Mattermost/          JSON API response
  (audit logs,      outbox alerts        (instant demo feedback)
  CRM upsert)
        │
        ▼
  Live Ops Dashboard (GET /dashboard-stats, 15s auto-refresh)
```

**Design principles applied consistently:**
- **AI extracts, code decides** — LLMs run at temperature 0.1–0.3 for determinism; payout/approval logic lives in auditable code
- **Graceful degradation** — every Google Sheets node uses `onError: continue`, so a credential outage never breaks the core pipeline
- **Outbox pattern** — outbound messages are queued, not sent inline (swap in the real channel node later, pipeline unchanged)
- **Strict JSON contracts** — agents respond with one JSON object; parsers strip fences without regex; enums normalized downstream
- **Everything testable via curl/HTML** — each pipeline answers through a webhook with a complete result payload

---

## 🛠 Tech Stack

n8n (n8n-as-code `.workflow.ts`) · Mistral AI (ministral-3b) · Groq (`openai/gpt-oss-120b`) · **Ollama (`nomic-embed-text`, local 768-dim embeddings)** · LangChain agent nodes · Google Sheets API · Gmail API (HTML invoices) · Mattermost webhooks · Meta WhatsApp webhook format · n8n Forms (file uploads) · Cloudflare tunnel (public demos) · Vanilla HTML/CSS/JS demo UIs

## 🚀 How To Run

**Try it live, no setup:** open the [portfolio site](https://haxanakhtarqtr.github.io/n8n-ai-portfolio/) — every demo runs against the public tunnel (`chat.hasanakhtar.co.uk`), so anyone can test the pipelines from anywhere.

**Self-host:**

1. Import any `workflows/*.workflow.ts` via [n8nac](https://www.npmjs.com/package/n8nac) (`npx n8nac push <file> --verify`), add Mistral + Groq + Gmail + Google Sheets credentials, activate.
2. Endpoints (after activation):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook/idp-invoice` | POST `{ rawText }` | Invoice extraction + validation |
| `/webhook/whatsapp-crm` | POST Meta payload or `{ from, name, message }` | Lead intelligence + CRM upsert |
| `/webhook/triage-message` | POST `{ sender, subject, message }` | Urgency/sentiment/spam triage |
| `/webhook/insurance-claim` | POST claim fields | Underwriting decision engine |
| `/webhook/restaurant-order` | POST `{ items, customer_email }` | Menu validation, VAT pricing, invoice email |
| `/webhook/resto-chat-trigger-01/chat` | POST `{ chatInput }` | AI receptionist conversation |
| `/form/cv-screening` | FORM (PDF upload) | CV screening: 0–100 match score → Google Sheets log |
| `/webhook/interview-scheduler` | POST `{ name, email, role }` | Deterministic interview slot booking + calendar invite |
| `/webhook/knowledge-base` | POST `{ question }` | RAG query: cosine search → grounded answer with citations |
| `/webhook/knowledge-base-upload` | POST `{ title, type, text }` | Programmatic KB ingest: chunk → embed → index |
| `/webhook/ask-data` | POST `{ question }` | NL analytics: Groq query plan → whitelist validation → deterministic execution |
| `/form/kb-upload` | FORM (PDF upload) | Human KB ingest: paste text or upload PDF |
| `/webhook/dashboard-stats` | GET | Live KPIs for all pipelines |

3. Demos: open any file in `demos/` in a browser. They default to the public tunnel; for a local instance, change the base URL constant at the top of each demo's JS back to `localhost:5678`.

## 📋 Skills Coverage (CV Claims → Working Proof)

| CV Claim | Proof |
|----------|-------|
| Intelligent Document Processing (IDP) | Invoice Extractor |
| n8n Workflow Automation (5/5) | All 10 workflows, as-code |
| Connect Email/WhatsApp/Web Forms to CRM | WhatsApp CRM + Triage Agent |
| Auto-tag urgency and priority | Triage Agent (critical/high/medium/low + SLA) |
| Sentiment Detection (4/5) | Triage Agent (−1..+1 scoring, anger cues) |
| AI Data Extraction | Invoice + Claim agents (strict JSON) |
| Predictive Lead Scoring | WhatsApp CRM (1–10 with buying signals) |
| Quotation Generation (5/5) | Invoice validation + claim reserve bands |
| Insurance Claims & Underwriting | Claim Intake Bot (coverage matrix, fraud scoring) |
| Real-time dashboards | Ops Dashboard (auto-refresh, health monitoring) |
| Conversational AI Agents (24/7 chat) | Restaurant AI Receptionist (chat intake + memory + order tool) |
| Automated Invoicing & Email | Restaurant Order API (HTML invoice via Gmail) |
| Process Optimization (5/5) | Auto-settle tiering, outbox pattern, graceful degradation |
| Recruitment / Talent Screening | CV Screening Bot (0–100 match scoring, strengths/gaps, Sheets ranking log) |
| Interview Coordination & Scheduling | Interview Scheduler (double-booking prevention, calendar invites, waitlist) |
| AI Model Vendor Resilience | Live provider model-list verification + retry-on-fail after Groq/Mistral API changes |
| RAG / Embeddings / Vector Search | RAG Knowledge Base (Ollama embeddings, cosine similarity in code, grounded citations) |
| NL→Data Analytics / NL2SQL-style Agent | Ask Your Data (Groq query planner, whitelist validator, deterministic JS execution engine) |

---

## 📫 Contact

**Hasan Akhtar** · Doha, Qatar · haxanakhtarqtr@gmail.com · +974 7713 7228

*Open to AI automation, sales operations, and digital growth roles in Qatar (with NOC) and remote.*
