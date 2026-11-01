# Post #4 — Live Ops Dashboard (Human Style Draft)

> Post kab: Day 4
> Attach image: `C:\N8N\portfolio\screenshots\05-ops-dashboard-live.png` (REAL data wala — Desktop par bhi hai)
> Clipboard: `Get-Content -Raw -Encoding UTF8 "C:\N8N\portfolio\POST-4-dashboard-draft.md" | Set-Clipboard`

---

## Caption (copy from here)

Fourth automation: a dashboard, because automation nobody can see is automation people don't trust.

The first three pipelines I posted (invoice validation, WhatsApp CRM, email triage) all write their results to Google Sheets. Rows go in, alerts fire, work happens. But when my manager asked how many invoices the system processed this week, the answer was "let me open the spreadsheet and count."

That answer bothered me.

So the pipelines now feed a small API in n8n. One GET request reads all three logs and returns the numbers that matter: invoices processed and their validity rate, messages triaged and the escalation rate, claims assessed and how many settled automatically. A dashboard page polls it and shows the live picture.

Two things I learned building it.

First, graceful degradation matters more than features. For a while a broken Google credential meant every log write failed silently. The dashboards kept running, the data just stopped. Now each source reports its own health, and the banner on the page tells you exactly which log is disconnected and why.

Second, respect the API quota. My first version refreshed every 15 seconds and Google politely told me I was sending too many requests. Sixty seconds is plenty.

The screenshot attached is the real dashboard with real test data: one invoice at 21,000 riyal, four claims assessed, every source green.

Built with n8n. Source on GitHub, link in the featured section.

#automation #n8n #ai #qatar

---

## First comment (pin it)

Source: github.com/haxanakhtarqtr/n8n-ai-portfolio
The health banner was the best part of this build. A dashboard that lies to you is worse than no dashboard, so every data source now reports whether it is actually ok, empty or erroring.

---

## Notes

- Yeh post technical credibility ke liye hai — "production lessons" wala angle
- Rate-limit story honestly batana trust build karta hai (perfect systems fake lagte hain)
- Screenshot mein REAL data hai (1 invoice 21k, 4 claims, green health) — clearly visible
