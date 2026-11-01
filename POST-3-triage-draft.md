# Post #3 — Email Triage & Sentiment Agent (Human Style Draft)

> Post kab: Day 3
> Attach image: `C:\N8N\portfolio\screenshots\02-triage-escalation.png`
> Clipboard: `Get-Content -Raw -Encoding UTF8 "C:\N8N\portfolio\POST-3-triage-draft.md" | Set-Clipboard`

---

## Caption (copy from here)

Third automation from the series: an email and message triage agent.

The background is simple. Customer messages arrive from email, WhatsApp and the website. Some are routine questions. Some are people who are genuinely angry and about to leave. In a busy inbox, the angry ones wait in the same queue as the newsletters.

So I built a triage layer in n8n. Every inbound message gets classified by an AI agent: category, urgency, sentiment on a scale of -1 to +1, and a priority score out of 10. The code layer then routes it. Critical messages hit the team channel on Mattermost within seconds, with a pre-drafted reply and a 15-minute SLA target. Everything else waits its turn honestly.

Testing it was my favorite part. I wrote the angriest customer email I could manage: third delay on an order, 15,000 riyal paid upfront, legal team mentioned. The agent scored it urgent, sentiment -0.9, priority 9 out of 10, and pulled the order number, the amount and the phone number out of the text automatically. The drafted reply was calm, apologetic and useful.

Then a polite quotation request scored neutral, 5 out of 10, no escalation. A lottery scam email got classified as spam with no reply drafted at all.

Built with n8n and Mistral AI. Source on GitHub, link in the featured section.

#automation #n8n #ai #qatar

---

## First comment (pin it)

Source: github.com/haxanakhtarqtr/n8n-ai-portfolio
The sentiment score never decides anything by itself. It feeds a routing rule in code, so a false negative just waits longer instead of sending a wrong automatic reply.

---

## Notes

- Story hook: "the angry ones wait in the same queue as the newsletters"
- Agar engagement acha ho to reply mein mention karein ke WhatsApp bhi same pipeline se aata hai
