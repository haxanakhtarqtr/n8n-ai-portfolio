# LinkedIn Post Drafts — Ready to Copy-Paste

> ✅ Ready-to-use LinkedIn posts for each pipeline. Pick your language.
> After pasting into LinkedIn, tag 1-2 relevant hashtags + add a CTA like *"See the live demos 👇"* — your demo pages are linked in `demos/` if hosted.

---

## 1) URDU  (Doha tech audience)

**Caption**

```
🚀 نیا پروجیکٹ: AI Invoice Extractor (IDP)

ٹیسٹنگ کے دوران ایک دلچند دہلا دادا 325 ریال (QAR 20,000 + 1,000 ٹیکس = 21,000 کی بجائے 8,200 لکھا تھا) AI نے خودکار پکڑ لیا۔

کیوں؟
• Mistral AI + n8n — صرف 240ms میں تمام فیلڈز ایکسٹرکٹ ہوتے ہیں
• مکمل ٹیک والی ٹیک اسٹریکچر: AI نکلے گیا، ڈیٹا دیا گیا — سب سے پہلے مانتی مزاحمت نہیں ہوتی
• جب بھی سبسیلنٹ + ٹیکس مماثل نا ہو تو Mattermost پر الرٹ

5 مکمل ٹیسٹ شدہ AI پائپ لائنز — GitHub لنک میچے گی۔ #AI #Automation #Qatar
```

**Comment (first pin):**

```
جو اہلاک 21,000 کی بجائے 8,200 لکھے — وہ یا تو بنیادی حساب کتاب کی غلطل ہو گی، یا جانب سے جچھلی۔
AI نے صرف 2.6s میں اسے پکڑ لیا۔ 👇
```

---

## 2) ENGLISH  (international / investor audience)

```
🚨 I built an AI that catches finance fraud before it pays out.

During a test of my Invoice Extractor (built on n8n + Mistral AI), I planted a deliberate error: subtotal QAR 20,000 + VAT 1,000 should = 21,000, but the invoice stated 8,200.

The bot spotted it instantly:
✅ 0.5s end-to-end processing
✅ 13 fields + 3 line items extracted
✅ MATH MISMATCH flag: "7,875 vs 8,200" → sent to Mattermost review

It then correctly processed a clean invoice (zero flags → auto pass) and flagged one with an impossible due date.

I built 5 production-tested AI pipelines — Invoice IDP, WhatsApp Lead CRM, Email Triage w/ Sentiment, Live Ops Dashboard, and Insurance Claim Intake.

Full architecture + source: github.com/haxanakhtarqtr/n8n-ai-portfolio

#AIdeveloper #MachineLearning #Automation #FinTech #Qatar #Doha #Startup
```

**Comment (first):**

```
The finance angle matters here: the rules engine runs AFTER the LLM — so a hallucinated number is always cross-checked against real math before any approval. This separation is what makes it audit-ready.
```

---

## 3) ROMAN URDU  (community / local network)

```
🚀 Hasan Akhtar — mera naya AI Automation portfolio live hai!

5 workflows banaye hain jo sabse pehle real-world finance/claims cases ko handle karte hain:

🧾 AI Invoice Extractor — test mein ek planted error pakra:
   Subtotal 20,000 + tax 1,000 = 21,000, lekin invoice ne likha 8,200
   → MATH MISMATCH flag + Mattermost alert
   processing time: 0.5s!

💬 WhatsApp CRM — real Meta webhook payload parse karta hai:
   Fatima se "25 desks, 18k budget" — score 9/10, auto-settle draft
   same phone se follow-up — CRM upsert, no duplicate
   crypto spam — filtered, koi reply nahi

⚖️ Insurance Claim Bot — QAR 38,000 suspicious claim:
   75 din late report + no police + pressure tactics
   → fraud score 5 → Special Investigation Unit tak

Dashboard API live KPIs deti hai (auto-refresh 15s).

github.com/haxanakhtarqtr/n8n-ai-portfolio

#n8n #ai #automation #qatar #doha #leadership #insurtech
```

---

## 🎯 Hashtag Guide (copy top line of each)

| Audience | Hashtags |
|----------|----------|
| Doha tech | `#AI #Automation #Qatar` |
| Intl tech | `#AIdeveloper #MachineLearning #Automation #FinTech` |
| Local network | `#n8n #ai #automation #qatar #doha #insurtech` |

## ✅ Posting instructions

1. Copy ONE caption + its comment
2. Add 1 screenshot (best result: the WhatsApp chat demo or invoice math-mismatch alert)
3. Tag colleagues who'd hire AI builders
4. Pin the comment so interviewers scroll to it first

---

## 📌 Ready-to-use one-liner hooks (A/B test friendly)

> Pick 1 as the **first line** of any post:

| Hook |
|------|
| I built an AI that catches finance fraud before it pays out. |
| I planted a fraud in my invoice bot and it caught it in 0.5s. |
| 5 AI workflows. 0 hallucinated payments. Meet my n8n portfolio. |
| My insurance bot gave a fraud score of 5 to a QAR 38,000 claim. It went to SIU. |
| This WhatsApp bot parses your real customer messages and scores leads 1-10. |

