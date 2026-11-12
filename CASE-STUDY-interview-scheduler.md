# Case Study 8 — Interview Scheduler

> Part 2 of the AI recruitment funnel. CV Screening Bot scores candidates; the Interview Scheduler books the interview — no email ping-pong, no double-booked calendars.

## Problem

After screening, coordinating interview times is manual: recruiters email candidates, candidates reply with availability, someone books the slot — and two candidates routinely end up with the same time. Nothing is tracked, and rescheduling means starting over.

## Solution

A webhook-driven scheduler built on one rule: **the AI never picks the slot — auditable code does.**

```
POST /webhook/interview-scheduler  { name, email, role }
        │
        ▼
deterministic slot engine (code node)
        │   Sun–Thu work week (Qatar) · slots 10:00 / 11:00 / 14:00 / 15:00 GMT+3
        │   45-minute duration · 14-day horizon
        │   skips every slot already booked in the Interview_Schedule sheet
        ▼
Book Slot ──▶ Google Sheets (Interview_Schedule log, status: confirmed / waitlist)
        │
        ▼
Build Confirmation ──▶ one-click "Add to Google Calendar" link (template URL)
        │
        ▼
Send Confirmation ──▶ Gmail (HTML, onError: continue — booking result still returns)
        │
        ▼
JSON response { status, slot_start, slot_end, display, alternates, gcal_link, email_sent }
```

## Design decisions

| Decision | Why |
|---|---|
| Deterministic slot engine in code | Availability rules are business logic — they must be reviewable and testable, not model output |
| Sheets as the booking store | Zero new infrastructure; the booking log lives in the same workbook as the CV screening log — one recruitment workbook |
| Side-branch sheet bootstrap | The "ensure sheet exists" node runs on a parallel branch with `onError: continue`, so the booking data path never sees sheet-API noise (lesson learned from the CV bot's first run) |
| Webhook v2 `body` normalization | Webhook v2.1 nests JSON payloads under `body` — intake handles both shapes |
| Waitlist fallback | If the 14-day horizon is fully booked, the candidate gets a polite waitlist email instead of a broken booking |
| Calendar via template link | No OAuth juggling on the candidate side — one click opens a pre-filled Google Calendar event |

## Live test evidence

| Test | Result |
|---|---|
| Booking #1 (requested on a Thursday) | First working day correctly resolved → **Sunday 15 Nov, 10:00 Doha** ✅ |
| Booking #2 (same request again) | Auto-shifted to **11:00** — double-booking blocked ✅ |
| Confirmation email | Delivered, `email_sent: true`, working Add-to-Calendar link ✅ |
| Alternates in response | Remaining free slots returned for the recruiter's reference ✅ |

## How to run

```bash
curl -X POST https://<your-n8n>/webhook/interview-scheduler \
  -H "Content-Type: application/json" \
  -d '{ "name": "Fatima Al-Marri", "email": "candidate@example.com", "role": "AI Automation Engineer" }'
```

Change the interviewer's availability by editing the `CONFIG` object at the top of the `Pick Interview Slot` code node — work days, slot hours, duration, horizon. No re-engineering required.

## Files

- `workflows/interview-scheduler.workflow.ts` — the workflow, as code
- Google Sheets tab: `Interview_Schedule` (booking log)

## Related

- **CV Screening & Ranking Bot** (Case Study 7) — the funnel's first stage: PDF CV → 0–100 match score → ranking log
