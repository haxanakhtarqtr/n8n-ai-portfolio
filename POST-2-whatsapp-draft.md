# Post #2 — WhatsApp Lead CRM (Human Style Draft)

> Post kab: kal (Post #1 ke 24 ghante baad, engagement peak par)
> Attach image: `C:\N8N\portfolio\screenshots\04-whatsapp-crm.png` (WhatsApp chat UI — dark green, real app jaisi lagti hai)
> Text clipboard par chahiye to: `Get-Content -Raw -Encoding UTF8 <file> | Set-Clipboard`

---

## Caption (copy from here)

Second automation from the five I've been building: a WhatsApp lead CRM.

The problem it solves is simple. Leads message us on WhatsApp at all hours. Someone has to read each message, decide if they're serious, type the details into a spreadsheet and reply. After hours, none of that happens until the next morning.

So I built a pipeline in n8n. When a WhatsApp message arrives, an AI reads it and pulls out what matters: what they want, how many units, their budget, their timeline. It scores the lead from 1 to 10 and drafts a short reply in the same tone the message came in.

The detail I care about most: the CRM is keyed on phone number. If the same person messages twice, their row updates. No duplicate contacts piling up. That single design choice is the difference between a demo and something you can actually run.

Testing it was the fun part. I sent a proper hot lead first, 25 desks, 18,000 riyal budget, West Bay delivery. Scored 9/10, reply drafted, contact created. Then a follow-up from the same number: same row updated, context kept. Then a crypto spam message: filtered, no reply drafted, nothing queued.

Built with n8n and Mistral AI. Full source and the test cases are on GitHub, link in the featured section.

#automation #n8n #ai #qatar

---

## First comment (pin it)

Source and the test payloads: github.com/haxanakhtarqtr/n8n-ai-portfolio
The WhatsApp pipeline parses the native Meta webhook format, so swapping in a real business number later is a trigger change, not a rebuild.

---

## Notes

- Post #1 ki tarah image pehle attach karein, phir text paste, phir Post
- Agar koi pooche "how does it connect to real WhatsApp" — jawab: Meta webhook format already handled, sirf official WhatsApp Trigger node lagana hai jab business number mile
