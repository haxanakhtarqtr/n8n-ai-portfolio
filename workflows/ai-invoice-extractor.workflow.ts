import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : AI Invoice & Document Extractor (IDP)
// Nodes   : 11  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// InvoiceHook                        webhook
// PrepareExtractionTask              code
// ExtractionAgent                    agent                      [AI]
// MistralModel                       lmChatMistralCloud         [creds] [ai_languageModel]
// ParseValidate                      code
// EnsureLogSheet                     googleSheets               [onError→regular] [creds]
// BuildInvoiceRow                    code
// AppendToInvoiceLog                 googleSheets               [onError→regular] [creds]
// NeedsReview                        if
// FlagForReview                      httpRequest
// ReturnExtractionResult             respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// InvoiceHook
//    → PrepareExtractionTask
//      → ExtractionAgent
//        → ParseValidate
//          → NeedsReview
//            → FlagForReview
//              → ReturnExtractionResult
//           .out(1) → ReturnExtractionResult (↩ loop)
//          → EnsureLogSheet
//          → BuildInvoiceRow
//            → AppendToInvoiceLog
//
// AI CONNECTIONS
// ExtractionAgent.uses({ ai_languageModel: MistralModel })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'JudKIHKh31FLmxXK',
    name: 'AI Invoice & Document Extractor (IDP)',
    active: true,
    isArchived: false,
    settings: { executionOrder: 'v1', availableInMCP: true, binaryMode: 'separate' },
})
export class AiInvoiceDocumentExtractorIdpWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'idp-invoice-hook',
        webhookId: 'idp-invoice-hook-01',
        name: 'Invoice Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [240, 300],
        notes: 'Accepts raw invoice text (rawText / text / invoiceText field) and returns the structured extraction in the HTTP response.',
    })
    InvoiceHook = {
        httpMethod: 'POST',
        path: 'idp-invoice',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'idp-prepare-task',
        name: 'Prepare Extraction Task',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [460, 300],
        notes: 'Normalizes the incoming payload into an extraction prompt for the AI agent.',
    })
    PrepareExtractionTask = {
        jsCode: `const item = $input.first().json;
const body = item.body || item;
const rawText = body.rawText || body.text || body.invoiceText || body.content || '';

if (!rawText) {
  throw new Error('No invoice text found. Send JSON body: { "rawText": "<invoice text>" }');
}

return [{
  json: {
    documentText: rawText,
    source: body.source || 'manual-upload',
    receivedAt: new Date().toISOString(),
  },
}];`,
    };

    @node({
        id: 'idp-extraction-agent',
        name: 'Extraction Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [680, 300],
        notes: 'Extracts structured invoice fields as strict JSON using the BANT-proven Mistral model.',
    })
    ExtractionAgent = {
        promptType: 'define',
        text: '={{ $json.documentText }}',
        options: {
            systemMessage: `You are an Intelligent Document Processing (IDP) engine specialized in invoices, bills, and quotations.

TASK: Extract structured data from the document text provided by the user.

OUTPUT RULES (STRICT):
1. Respond with ONE JSON object and NOTHING else. No explanations, no markdown fences.
2. Use null for any field you cannot find. Never invent values.
3. All money amounts as plain numbers (no currency symbols, no thousand separators).
4. All dates in YYYY-MM-DD format.

JSON SCHEMA:
{
  "vendor_name": string,
  "vendor_tax_id": string,
  "invoice_number": string,
  "po_number": string,
  "invoice_date": string (YYYY-MM-DD),
  "due_date": string (YYYY-MM-DD),
  "currency": string (ISO code e.g. QAR, USD, AED),
  "subtotal": number,
  "tax_rate": number (percent, e.g. 5 for 5%),
  "tax_amount": number,
  "total": number,
  "payment_terms": string,
  "line_items": [ { "description": string, "qty": number, "unit_price": number, "amount": number } ],
  "notes": string
}`,
        },
    };

    @node({
        id: 'idp-mistral-model',
        name: 'Mistral Model',
        type: '@n8n/n8n-nodes-langchain.lmChatMistralCloud',
        version: 1,
        position: [620, 520],
        credentials: { mistralCloudApi: { id: 'fCLkBkCGQaMocIDv', name: 'Mistral Cloud account' } },
    })
    MistralModel = {
        model: 'ministral-3b-latest',
        options: {
            temperature: 0.1,
        },
    };

    @node({
        id: 'idp-parse-validate',
        name: 'Parse & Validate',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [900, 300],
        notes: 'Parses the agent JSON, then runs finance-grade validation: required fields, tax math, line-item sums, date order. Produces validation flags and is_valid.',
    })
    ParseValidate = {
        jsCode: `const agentOut = $input.first().json.output || '';
const flags = [];

// Extract JSON without regex: find first { and last }
const start = agentOut.indexOf('{');
const end = agentOut.lastIndexOf('}');
if (start === -1 || end === -1) {
  throw new Error('Agent did not return JSON. Raw output: ' + agentOut.substring(0, 200));
}
let invoice;
try {
  invoice = JSON.parse(agentOut.substring(start, end + 1));
} catch (err) {
  throw new Error('Agent JSON could not be parsed: ' + err.message);
}

// 1. Required fields
const required = ['vendor_name', 'invoice_number', 'invoice_date', 'total'];
for (const field of required) {
  if (invoice[field] === null || invoice[field] === undefined || invoice[field] === '') {
    flags.push({ code: 'MISSING_' + field.toUpperCase(), severity: 'ERROR', message: 'Required field ' + field + ' not found in document' });
  }
}

// 2. Tax math: subtotal + tax must equal total (1% tolerance)
const subtotal = Number(invoice.subtotal) || 0;
const taxAmount = Number(invoice.tax_amount) || 0;
const total = Number(invoice.total) || 0;
if (subtotal > 0 && total > 0) {
  const expectedTotal = subtotal + taxAmount;
  const tolerance = Math.max(1, total * 0.01);
  if (Math.abs(expectedTotal - total) > tolerance) {
    flags.push({ code: 'MATH_MISMATCH', severity: 'ERROR', message: 'Subtotal (' + subtotal + ') + tax (' + taxAmount + ') = ' + expectedTotal + ' does not match total (' + total + ')' });
  }
}

// 3. Line items sum vs subtotal
const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
if (items.length > 0 && subtotal > 0) {
  const itemsSum = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const tolerance = Math.max(1, subtotal * 0.02);
  if (Math.abs(itemsSum - subtotal) > tolerance) {
    flags.push({ code: 'LINE_ITEMS_MISMATCH', severity: 'WARNING', message: 'Line items sum (' + itemsSum + ') does not match subtotal (' + subtotal + ')' });
  }
}

// 4. Date sanity: due date must not precede invoice date
const invDate = new Date(invoice.invoice_date);
const dueDate = new Date(invoice.due_date);
if (!isNaN(invDate.getTime()) && !isNaN(dueDate.getTime()) && dueDate < invDate) {
  flags.push({ code: 'DATE_ORDER_WARNING', severity: 'WARNING', message: 'Due date (' + invoice.due_date + ') is before invoice date (' + invoice.invoice_date + ')' });
}

// 5. Optional-field info flags
const optional = ['vendor_tax_id', 'po_number', 'payment_terms'];
for (const field of optional) {
  if (invoice[field] === null || invoice[field] === undefined || invoice[field] === '') {
    flags.push({ code: 'OPTIONAL_EMPTY_' + field.toUpperCase(), severity: 'INFO', message: 'Optional field ' + field + ' not present' });
  }
}

const errorFlags = flags.filter(f => f.severity === 'ERROR');
const isValid = errorFlags.length === 0;
const flagSummary = flags.map(f => f.code).join(', ') || 'none';

return [{
  json: {
    invoice: invoice,
    is_valid: isValid,
    flags: flags,
    flag_summary: flagSummary,
    extracted_at: new Date().toISOString(),
  },
}];`,
    };

    @node({
        id: 'idp-ensure-sheet',
        name: 'Ensure Log Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1120, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Creates the Invoice_Log tab on first run. Errors (tab already exists, credential gap) do not block the extraction result.',
    })
    EnsureLogSheet = {
        resource: 'sheet',
        operation: 'create',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        title: 'Invoice_Log',
        options: {},
    };

    @node({
        id: 'idp-build-row',
        name: 'Build Invoice Row',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1030, 440],
        notes: 'Flattens the extraction result into one row matching the Invoice_Log headers (autoMapInputData creates headers on the empty sheet).',
    })
    BuildInvoiceRow = {
        jsCode: `const src = $('Parse & Validate').item.json;
return [{
  json: {
    'Timestamp': src.extracted_at,
    'Vendor': src.invoice.vendor_name,
    'Invoice Number': src.invoice.invoice_number,
    'Invoice Date': src.invoice.invoice_date,
    'Due Date': src.invoice.due_date,
    'Currency': src.invoice.currency,
    'Subtotal': src.invoice.subtotal,
    'Tax': src.invoice.tax_amount,
    'Total': src.invoice.total,
    'Status': src.is_valid ? 'Valid' : 'Needs Review',
    'Flags': src.flag_summary,
  },
}];`,
    };

    @node({
        id: 'idp-append-log',
        name: 'Append to Invoice Log',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1340, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Appends one row per extracted invoice. Sheet errors do not block the API response (onError continue).',
    })
    AppendToInvoiceLog = {
        operation: 'append',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Invoice_Log',
        },
        columns: {
            mappingMode: 'autoMapInputData',
        },
        options: {},
    };

    @node({
        id: 'idp-needs-review',
        name: 'Needs Review?',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [1560, 300],
        notes: 'True = validation errors found (alert the finance channel). False = clean extraction.',
    })
    NeedsReview = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'cond-is-invalid',
                    leftValue: "={{ $('Parse & Validate').item.json.is_valid }}",
                    rightValue: false,
                    operator: {
                        type: 'boolean',
                        operation: 'false',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'idp-flag-review',
        name: 'Flag for Review',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.5,
        position: [1780, 180],
        notes: 'Posts validation issues to the Mattermost finance channel for human review.',
    })
    FlagForReview = {
        method: 'POST',
        url: 'http://host.docker.internal:8065/hooks/zceo56iq8b8mdpkzfj3ehan6ny',
        authentication: 'none',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ text: '📄 *Invoice Extraction Needs Review*\\n\\nVendor: ' + ($('Parse & Validate').item.json.invoice.vendor_name || 'unknown') + '\\nInvoice #: ' + ($('Parse & Validate').item.json.invoice.invoice_number || 'unknown') + '\\nTotal: ' + ($('Parse & Validate').item.json.invoice.total || 'unknown') + ' ' + ($('Parse & Validate').item.json.invoice.currency || '') + '\\nFlags: ' + $('Parse & Validate').item.json.flag_summary }) }}",
        options: {},
    };

    @node({
        id: 'idp-return-result',
        name: 'Return Extraction Result',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.5,
        position: [2000, 300],
        notes: 'Returns the structured extraction + validation verdict as JSON to the caller. Single response node for both branches.',
    })
    ReturnExtractionResult = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ status: $('Parse & Validate').item.json.is_valid ? 'valid' : 'needs_review', extracted_at: $('Parse & Validate').item.json.extracted_at, invoice: $('Parse & Validate').item.json.invoice, validation_flags: $('Parse & Validate').item.json.flags, logged_to_sheets: true }) }}",
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.InvoiceHook.out(0).to(this.PrepareExtractionTask.in(0));
        this.PrepareExtractionTask.out(0).to(this.ExtractionAgent.in(0));
        this.ExtractionAgent.out(0).to(this.ParseValidate.in(0));
        this.ParseValidate.out(0).to(this.NeedsReview.in(0));
        this.ParseValidate.out(0).to(this.EnsureLogSheet.in(0));
        this.ParseValidate.out(0).to(this.BuildInvoiceRow.in(0));
        this.BuildInvoiceRow.out(0).to(this.AppendToInvoiceLog.in(0));
        this.NeedsReview.out(0).to(this.FlagForReview.in(0));
        this.NeedsReview.out(1).to(this.ReturnExtractionResult.in(0));
        this.FlagForReview.out(0).to(this.ReturnExtractionResult.in(0));

        this.ExtractionAgent.uses({
            ai_languageModel: this.MistralModel.output,
        });
    }
}
