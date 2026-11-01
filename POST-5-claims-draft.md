# Post #5 — Insurance Claim Intake Bot (Human Style Draft)

> Post kab: Day 5 (series finale)
> Attach image: `C:\N8N\portfolio\screenshots\03-claim-siu.png` (Special Investigation Unit wala)
> Clipboard: `Get-Content -Raw -Encoding UTF8 "C:\N8N\portfolio\POST-5-claims-draft.md" | Set-Clipboard`

---

## Caption (copy from here)

Fifth automation, and the one closest to home: an insurance claim intake bot.

Before automation and AI, I spent years in insurance. Underwriting support, claims for Jubilee, IGI and EFU, risk inspections, the paperwork that follows a fire or a motor accident. So when I say claims intake is slow, I am not guessing. A claim arrives by email, someone reads it, decides which team handles it, checks the policy actually covers it, and asks for documents. The customer hears nothing for days.

This bot changes the first hour, not the whole process. A claim comes in, the AI extracts the facts: what type of claim it is, what happened, when, how much. Then a rules engine takes over and it never lets the AI make the decision. The coverage matrix checks the policy type against the claim type. Fraud indicators add up: no police report, reporting delay over thirty days, pressure to settle, a claim history. Then one of four routes: instant auto-settle under 2,000 riyals, fast-track, underwriter review, or the investigation unit.

Three test claims told the whole story. A clean 1,450 riyal motor claim with a police report: auto-settled in one pass. A fire claim filed on a motor policy: caught by the coverage matrix before an underwriter wasted a morning on it. A 38,000 riyal claim reported 75 days late with no police report, no photos and a story about needing money urgently: fraud score five, straight to investigation.

The line I keep coming back to: the AI extracts, the code decides. An AI that approves payouts on its own is not a tool I would put in front of a regulator.

Built with n8n and Mistral AI. Source on GitHub, link in the featured section.

#insurance #automation #n8n #insurtech #qatar

---

## First comment (pin it)

Source: github.com/haxanakhtarqtr/n8n-ai-portfolio
The four-tier routing is the part insurers ask about first. Auto-settle under 2,000 with zero fraud indicators took the small claims queue to zero in testing, which is where most of the manual volume actually lives.

---

## Notes

- Yeh AAPKA differentiator post hai — 15 saal ka insurance experience + AI. Koi aur candidate yeh combine nahi kar sakta
- "The AI extracts, the code decides" — yeh line aapki brand line ban chuki hai, ise har interview mein use karein
- Insurance companies/GCC insurers ko DM karne ka moqa — yeh post unke liye hai
