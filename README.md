# 🤖 AI Automation Portfolio — n8n + LLM Production Pipelines

> Five production-tested AI automation pipelines built with n8n-as-code and Mistral AI — intelligent document processing, WhatsApp lead CRM, email triage with sentiment detection, live operations dashboards, and AI-assisted insurance underwriting.

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

n8n (n8n-as-code `.workflow.ts`) · Mistral AI (ministral-3b) · LangChain agent nodes · Google Sheets API · Mattermost webhooks · Meta WhatsApp webhook format · Vanilla HTML/CSS/JS demo UIs

## 🚀 How To Run

1. **n8n**: import any `workflows/*.workflow.ts` via [n8nac](https://www.npmjs.com/package/n8nac) (`npx n8nac push <file> --verify`), add a Mistral API credential, activate.
2. **Endpoints** (after activation):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook/idp-invoice` | POST `{ rawText }` | Invoice extraction + validation |
| `/webhook/whatsapp-crm` | POST Meta payload or `{ from, name, message }` | Lead intelligence + CRM upsert |
| `/webhook/triage-message` | POST `{ sender, subject, message }` | Urgency/sentiment/spam triage |
| `/webhook/insurance-claim` | POST claim fields | Underwriting decision engine |
| `/webhook/dashboard-stats` | GET | Live KPIs for all pipelines |

3. **Demos**: open any file in `demos/` in a browser (n8n must be running on `localhost:5678`).

## 📋 Skills Coverage (CV Claims → Working Proof)

| CV Claim | Proof |
|----------|-------|
| Intelligent Document Processing (IDP) | Invoice Extractor |
| n8n Workflow Automation (5/5) | All 5 workflows, as-code |
| Connect Email/WhatsApp/Web Forms to CRM | WhatsApp CRM + Triage Agent |
| Auto-tag urgency and priority | Triage Agent (critical/high/medium/low + SLA) |
| Sentiment Detection (4/5) | Triage Agent (−1..+1 scoring, anger cues) |
| AI Data Extraction | Invoice + Claim agents (strict JSON) |
| Predictive Lead Scoring | WhatsApp CRM (1–10 with buying signals) |
| Quotation Generation (5/5) | Invoice validation + claim reserve bands |
| Insurance Claims & Underwriting | Claim Intake Bot (coverage matrix, fraud scoring) |
| Real-time dashboards | Ops Dashboard (15s refresh, health monitoring) |
| Process Optimization (5/5) | Auto-settle tiering, outbox pattern, graceful degradation |

---

## 📫 Contact

**Hasan Akhtar** · Doha, Qatar · haxanakhtarqtr@gmail.com · +974 7713 7228

*Open to AI automation, sales operations, and digital growth roles in Qatar (with NOC) and remote.*
