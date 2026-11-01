# Post #6 — Restaurant AI Receptionist (Human Style Draft)

> Post kab: Day 6-7 (5-post series khatam hone ke baad)
> Attach image: demo page ka screenshot (light theme chat + order panel) — `restaurant-receptionist-demo.html` khol kar screenshot lein
> Background story: yeh idea kisi aur ke LinkedIn post se mila (Bixon AI ka restaurant bot) — "someone posted one, so I built my own version" healthy builder angle hai

---

## Caption (copy from here)

Someone posted a restaurant AI receptionist on LinkedIn last week. Nice build. So I made my own version to see how long it would take with the architecture I already had.

Answer: an afternoon.

The setup is two workflows talking to each other. The receptionist is an AI agent with the menu baked into its instructions and a memory window per customer. When a customer confirms an order and gives their email, the agent calls a second workflow through an API. That second workflow does the part I never let the AI touch: it checks every item against the menu, prices the order, adds 5% VAT and generates the invoice. Then Gmail sends it.

The rule I keep repeating: the AI talks, the code decides. An AI receptionist that invents prices or menu items is a liability, not a tool.

Test run:
- 2 Chicken Mandi plus a Fattoush Salad: confirmed, 77.70 QAR, invoice emailed
- Pepperoni pizza, which is not on the menu: politely refused, closest items suggested
- "3 pepsi": mapped to Soft Drinks, quantity confirmed before submitting
- Same customer returning: conversation memory kept their context

Total build time was about an hour and a half, and most of that was already paid for by the patterns from my other five pipelines. That is the real value of building on one architecture: the sixth automation is cheaper than the first.

Full source is on GitHub, link in the featured section.

#automation #n8n #ai #qatar

---

## First comment (pin it)

Source for both workflows (receptionist + order API): github.com/haxanakhtarqtr/n8n-ai-portfolio
The order API response contract is order_id, order_status, email_status — same shape the reference build used, so it drops into any POS integration that expects that shape.

---

## Notes

- Honest builder angle is the hook: "saw it, built my own, here's what happened"
- Emphasize: AI never prices orders — menu discipline is code (yehi aapka brand hai)
- Agar koi pooche delivery/payment ke bare mein: v2 roadmap items, honest answer do
