# AI Invoice & Document Extractor (IDP)

> Intelligent Document Processing pipeline built with n8n + Mistral AI — extracts 15+ structured fields from raw invoice text, runs finance-grade validation (tax math, date logic, line-item sums), logs to Google Sheets, and alerts reviewers when something looks wrong.

**Author:** Hasan Akhtar — AI & Digital Growth Specialist (Doha, Qatar)

---

## The Problem

Small and mid-size businesses in GCC markets receive hundreds of invoices by email and WhatsApp. Manual data entry means:

- 3–5 minutes per invoice just to type fields into a spreadsheet
- Tax calculation errors and duplicate payments go unnoticed
- No audit trail of who extracted what and when

## The Solution

A single webhook endpoint that turns any invoice text into validated, structured data:

```
Invoice Hook (webhook)
  → Prepare Extraction Task
    → AI Extraction Agent (Mistral, temperature 0.1)
      → Parse & Validate (finance rules engine)
        → Google Sheets log (Invoice_Log tab)
          → Needs Review? (conditional routing)
              ├─ validation errors → Mattermost alert to finance channel
              └─ clean extraction → instant JSON response
```

**Extracted fields:** vendor name, vendor tax ID, invoice number, PO number, invoice date, due date, currency, subtotal, tax rate, tax amount, total, payment terms, line items (description, qty, unit price, amount), notes.

**Validation rules applied automatically:**

| Rule | Severity | Example |
|------|----------|---------|
| Required fields present (vendor, invoice #, date, total) | ERROR | Missing vendor blocks approval |
| Subtotal + tax = total (1% tolerance) | ERROR | Catches computation fraud/errors |
| Line items sum = subtotal (2% tolerance) | WARNING | Catches partial line-item entry |
| Due date ≥ invoice date | WARNING | Catches impossible payment terms |
| Optional fields status (tax ID, PO, terms) | INFO | Transparency for reviewers |

---

## Proof of Work — Test Results

### Test 1: Clean invoice → auto-approved

**Input (raw invoice text):**

```
GULF TECHNICAL SERVICES W.L.L.
Tax ID: QAR-TIN-100234567
TAX INVOICE
Invoice No: INV-2026-00847
PO Number: PO-5521
Invoice Date: 2026-10-15
...
Subtotal: QAR 20,000.00
VAT (5%): QAR 1,000.00
TOTAL DUE: QAR 21,000.00
```

**Output (API response):**

```json
{
  "status": "valid",
  "invoice": {
    "vendor_name": "GULF TECHNICAL SERVICES W.L.L.",
    "vendor_tax_id": "QAR-TIN-100234567",
    "invoice_number": "INV-2026-00847",
    "po_number": "PO-5521",
    "invoice_date": "2026-10-15",
    "due_date": "2026-11-14",
    "currency": "QAR",
    "subtotal": 20000,
    "tax_rate": 5,
    "tax_amount": 1000,
    "total": 21000,
    "payment_terms": "Net 30 days",
    "line_items": [
      { "description": "Annual Software Maintenance - ERP Module", "qty": 1, "unit_price": 12000, "amount": 12000 },
      { "description": "On-site Technical Support (40 hrs)", "qty": 40, "unit_price": 150, "amount": 6000 },
      { "description": "Data Migration Assistance", "qty": 1, "unit_price": 2000, "amount": 2000 }
    ]
  },
  "validation_flags": []
}
```

Tax math verified: **20,000 + 1,000 = 21,000 QAR** ✅ — status `valid`, zero flags.

### Test 2: Corrupted invoice → caught before payment

**Input contained two deliberate traps:** a wrong total and an impossible due date.

**Output (excerpt):**

```json
{
  "status": "needs_review",
  "validation_flags": [
    {
      "code": "MATH_MISMATCH",
      "severity": "ERROR",
      "message": "Subtotal (7500) + tax (375) = 7875 does not match total (8200)"
    },
    {
      "code": "DATE_ORDER_WARNING",
      "severity": "WARNING",
      "message": "Due date (2026-10-10) is before invoice date (2026-10-20)"
    }
  ]
}
```

A **325 QAR overcharge** was caught automatically and routed to the finance channel on Mattermost for human review — before any payment was made.

---

## Tech Stack

- **n8n** (as-code via `.workflow.ts`) — orchestration, webhook, routing
- **Mistral AI** (ministral-3b-latest, temperature 0.1) — deterministic field extraction
- **Google Sheets API** — append-only audit log
- **Mattermost webhook** — real-time reviewer alerts
- **Error-tolerant design** — Google Sheets outage never blocks extraction (onError continue)

## Run It Yourself

```bash
curl -X POST "http://localhost:5678/webhook/idp-invoice" \
  -H "Content-Type: application/json" \
  -d '{ "rawText": "<paste any invoice text here>" }'
```

The workflow file (`ai-invoice-extractor.workflow.ts`) uses n8n-as-code decorators and can be pushed to any n8n instance with `n8nac push`.

## What This Demonstrates

- n8n workflow automation with AI agents (LangChain nodes)
- Prompt engineering for strict JSON extraction
- Finance-domain validation logic (built on 15+ years of accounting/insurance experience)
- API integration design with graceful degradation
- Documentation and testing discipline (documented before/after proof)
