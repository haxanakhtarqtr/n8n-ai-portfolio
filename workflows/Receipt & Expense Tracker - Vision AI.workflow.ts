import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Receipt & Expense Tracker - Vision AI
// Nodes   : 19  |  Connections: 18
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ReceiptHook                        webhook
// EnsureExpensesTab                  googleSheets               [onError→regular] [creds] [alwaysOutput]
// ReadExpenses                       googleSheets               [onError→regular] [creds] [alwaysOutput] [retry]
// BuildContext                       code
// AnalyzeReceipt                     httpRequest                [onError→regular] [creds] [alwaysOutput] [retry]
// ValidateReceipt                    code
// IfLogWorthy                        if
// AppendExpense                      googleSheets               [creds] [retry]
// ShapeLogRow                        code
// BuildExpenseResponse               code
// ReturnExpenseResponse              respondToWebhook
// DigestHook                         webhook
// MonthlyCron                        scheduleTrigger
// ReadExpensesDigest                 googleSheets               [onError→regular] [creds] [alwaysOutput] [retry]
// AggregateMonth                     code
// DraftDigest                        httpRequest                [creds] [retry]
// BuildDigestEmail                   code
// SendDigestEmail                    gmail                      [onError→regular] [creds] [retry]
// RespondDigest                      respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ReceiptHook
//    → ReadExpenses
//      → BuildContext
//        → AnalyzeReceipt
//          → ValidateReceipt
//            → IfLogWorthy
//              → ShapeLogRow
//                → AppendExpense
//                  → BuildExpenseResponse
//                    → ReturnExpenseResponse
//             .out(1) → BuildExpenseResponse (↩ loop)
//    → EnsureExpensesTab
// DigestHook
//    → ReadExpensesDigest
//      → AggregateMonth
//        → DraftDigest
//          → BuildDigestEmail
//            → SendDigestEmail
//              → RespondDigest
// MonthlyCron
//    → ReadExpensesDigest (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'RVARuyy3SorXHZJY',
    name: 'Receipt & Expense Tracker - Vision AI',
    active: true,
    isArchived: false,
    projectId: 'WkdztVBhxnc914pU',
})
export class ReceiptExpenseTrackerVisionAiWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'rv000001-0001-4b2c-9d3e-rv0000000001',
        webhookId: 'receipt-expense-hook-01',
        name: 'Receipt Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-1140, 0],
        notes: 'Receipt intake: POST { image_base64, mime_type }. Demo front-end uploads a photo as base64.',
    })
    ReceiptHook = {
        httpMethod: 'POST',
        path: 'receipt-expense',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'rv000001-0002-4b2c-9d3e-rv0000000002',
        name: 'Ensure Expenses Tab',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-920, 0],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
    })
    EnsureExpensesTab = {
        resource: 'sheet',
        operation: 'create',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        title: 'Expenses',
        options: {},
    };

    @node({
        id: 'rv000001-0003-4b2c-9d3e-rv0000000003',
        name: 'Read Expenses',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-700, 0],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    ReadExpenses = {
        resource: 'sheet',
        operation: 'read',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Expenses',
        },
        options: {},
    };

    @node({
        id: 'rv000001-0004-4b2c-9d3e-rv0000000004',
        name: 'Build Context',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-480, 0],
    })
    BuildContext = {
        jsCode: `// ============================================================
// CONTEXT BUILDER - collapses the loaded expense log (0..N items)
// into one item that carries both the existing log rows (for
// duplicate detection) and the incoming request payload.
// ============================================================
const hook = $('Receipt Hook').item.json;
const body = (hook.body && typeof hook.body === 'object') ? hook.body : hook;
const logRows = $input.all()
  .map(i => i.json)
  .filter(r => r && r.expense_id && String(r.expense_id).trim() !== '');
return [{ json: {
  log_rows: logRows.map(r => ({
    expense_id: r.expense_id,
    vendor: String(r.vendor ?? '').toLowerCase().trim(),
    date: String(r.date ?? ''),
    total: Number(r.total ?? NaN),
    status: r.status
  })),
  request: {
    image_base64: body.image_base64 || null,
    mime_type: body.mime_type || body.mimeType || 'image/png',
    submitted_by: body.submitted_by || 'demo',
    note: body.note || ''
  },
  log_size: logRows.length
}}];`,
    };

    @node({
        id: 'rv000001-0005-4b2c-9d3e-rv0000000005',
        name: 'Analyze Receipt',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-260, 0],
        credentials: { groqApi: { id: '6VUycnVaIxEH5YXv', name: 'Groq account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    AnalyzeReceipt = {
        method: 'POST',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'groqApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ model: \'qwen/qwen3.8-27b\', temperature: 0.1, max_tokens: 800, response_format: { type: \'json_object\' }, messages: [ { role: \'user\', content: [ { type: \'text\', text: "You are a receipt data extraction engine for an expense-tracking system. Look at the receipt image and extract ALL visible data into ONE strict JSON object.\\\\n\\\\nOUTPUT SCHEMA:\\\\n{\\"vendor\\": \\"<merchant name>\\", \\"receipt_number\\": \\"<number or null>\\", \\"date\\": \\"<YYYY-MM-DD>\\", \\"currency\\": \\"<ISO code like QAR, AED, USD>\\", \\"line_items\\": [{\\"description\\": \\"<item>\\", \\"qty\\": <number or null>, \\"unit_price\\": <number or null>, \\"amount\\": <number>}], \\"subtotal\\": <number or null>, \\"tax\\": <number or null>, \\"total\\": <number>, \\"payment_method\\": \\"<cash|card|other or null>\\", \\"category_hint\\": \\"<short guess like meals, fuel, office, transport, telecom, hotel, other>\\", \\"image_quality\\": \\"<clear|partial|poor>\\"}\\\\n\\\\nRULES:\\\\n- Numbers: plain numbers, no thousand separators, no currency symbols.\\\\n- tax = VAT/GST/sales tax line if shown; if tax is included in prices and not itemized, set tax null.\\\\n- total = grand total payable. subtotal = pre-tax sum if shown, else null.\\\\n- Extract ONLY what is visible. Never compute or infer a value that is not on the receipt.\\\\n- If the year is missing from the date, infer the most plausible year and note it via image_quality \\"partial\\".\\\\n- If the image is not a receipt at all, output {\\"not_a_receipt\\": true}.\\\\n- Output ONLY the JSON object." }, { type: \'image_url\', image_url: { url: \'data:\' + $json.request.mime_type + \';base64,\' + $json.request.image_base64 } } ] } ] }) }}',
        options: {
            timeout: 90000,
        },
    };

    @node({
        id: 'rv000001-0006-4b2c-9d3e-rv0000000006',
        name: 'Validate Receipt',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-40, 0],
    })
    ValidateReceipt = {
        jsCode: `// DEBUG: pass through vision errors transparently
const item = $json;
if (item.error && !item.choices) {
  return [{ json: { decision: 'skip', status: 'vision_error', vision_error: item.error, request_note: 'see vision_error' } }];
}
// ============================================================
// RECEIPT VALIDATOR - deterministic finance-grade checks.
// A receipt the code cannot trust is flagged, not trusted.
// Duplicate receipts are skipped by exact hash match.
// ============================================================
const ctx = $('Build Context').item.json;
const hook = $('Receipt Hook').item.json;
const body = (hook.body && typeof hook.body === 'object') ? hook.body : hook;

let raw;
try {
  let txt = String(($json.choices || [])[0]?.message?.content ?? '');
  txt = txt.replace(/\`[^\`]*\`/g, '').replace(/\`\`\`json|\`\`\`/g, '').trim();
  raw = JSON.parse(txt);
} catch (e) {
  return [{ json: {
    decision: 'log', status: 'needs_review',
    parse_error: 'vision JSON unparseable: ' + e.message,
    extracted: null, flags: ['unparseable_extraction'],
    request: ctx.request, log_size: ctx.log_size
  }}];
}

if (raw.not_a_receipt) {
  return [{ json: {
    decision: 'skip', status: 'not_a_receipt',
    extracted: null, flags: ['image is not a receipt'],
    request: ctx.request, log_size: ctx.log_size
  }}];
}

const flags = [];
const checks = [];
const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
const extracted = {
  vendor: raw.vendor ? String(raw.vendor).trim() : null,
  receipt_number: raw.receipt_number ? String(raw.receipt_number).trim() : null,
  date: raw.date ? String(raw.date).trim() : null,
  currency: raw.currency ? String(raw.currency).trim().toUpperCase() : null,
  line_items: Array.isArray(raw.line_items) ? raw.line_items.map(li => ({
    description: li.description ? String(li.description).trim() : 'item',
    qty: num(li.qty), unit_price: num(li.unit_price), amount: num(li.amount)
  })) : [],
  subtotal: num(raw.subtotal), tax: num(raw.tax), total: num(raw.total),
  payment_method: raw.payment_method ? String(raw.payment_method).trim() : null,
  category_hint: raw.category_hint ? String(raw.category_hint).trim().toLowerCase() : null,
  image_quality: raw.image_quality ? String(raw.image_quality) : 'unknown'
};

// check 1: required fields
const missing = [];
if (!extracted.vendor) missing.push('vendor');
if (!extracted.date) missing.push('date');
if (extracted.total === null) missing.push('total');
if (missing.length) flags.push('missing_fields: ' + missing.join(', '));
checks.push({ check: 'required fields', pass: missing.length === 0 });

// check 2: date sanity (parseable, not future, not ancient)
if (extracted.date) {
  const d = new Date(extracted.date);
  if (isNaN(d.getTime())) { flags.push('unparseable date: ' + extracted.date); checks.push({ check: 'date parse', pass: false }); }
  else {
    const today = new Date(); today.setHours(0,0,0,0);
    const diffDays = Math.round((today - d) / 86400000);
    if (diffDays < -2) { flags.push('date is in the future: ' + extracted.date); checks.push({ check: 'date not future', pass: false }); }
    else if (diffDays > 3650) { flags.push('date is implausibly old: ' + extracted.date); checks.push({ check: 'date not ancient', pass: false }); }
    else checks.push({ check: 'date sanity', pass: true });
  }
}

// check 3: line items sum vs subtotal
if (extracted.subtotal !== null && extracted.line_items.length) {
  const itemsSum = extracted.line_items.reduce((s, li) => s + (li.amount ?? (li.qty ?? 1) * (li.unit_price ?? 0)), 0);
  const diff = Math.abs(itemsSum - extracted.subtotal);
  const tol = Math.max(0.02, extracted.subtotal * 0.01);
  if (diff > tol) flags.push('line_items sum ' + itemsSum.toFixed(2) + ' vs subtotal ' + extracted.subtotal + ' (diff ' + diff.toFixed(2) + ')');
  checks.push({ check: 'line items sum = subtotal', pass: diff <= tol });
}

// check 4: subtotal + tax vs total
if (extracted.total !== null) {
  if (extracted.subtotal !== null && extracted.tax !== null) {
    const calc = extracted.subtotal + extracted.tax;
    const diff = Math.abs(calc - extracted.total);
    const tol = Math.max(0.02, extracted.total * 0.01);
    if (diff > tol) flags.push('subtotal ' + extracted.subtotal + ' + tax ' + extracted.tax + ' = ' + calc + ' vs total ' + extracted.total + ' (diff ' + diff.toFixed(2) + ')');
    checks.push({ check: 'subtotal + tax = total', pass: diff <= tol });
  } else if (extracted.subtotal !== null && extracted.tax === null) {
    const diff = Math.abs(extracted.subtotal - extracted.total);
    const tol = Math.max(0.02, extracted.total * 0.01);
    if (diff > tol && diff / Math.max(extracted.total, 1) > 0.05) flags.push('tax not itemized: subtotal ' + extracted.subtotal + ' vs total ' + extracted.total);
    checks.push({ check: 'total vs subtotal (tax null)', pass: true });
  }
}

// check 5: total positive
if (extracted.total !== null && extracted.total <= 0) flags.push('total is not positive: ' + extracted.total);
checks.push({ check: 'total > 0', pass: extracted.total === null ? false : extracted.total > 0 });

// check 6: duplicate detection against the existing log
const dupKey = extracted.vendor && extracted.date && extracted.total !== null
  ? extracted.vendor.toLowerCase().trim() + '|' + extracted.date + '|' + extracted.total
  : null;
let duplicateOf = null;
if (dupKey) {
  for (const r of ctx.log_rows) {
    const rk = r.vendor + '|' + r.date + '|' + r.total;
    if (rk === dupKey) { duplicateOf = r.expense_id; break; }
  }
}
if (duplicateOf) flags.push('duplicate of ' + duplicateOf + ' (vendor+date+total hash match)');
checks.push({ check: 'duplicate hash', pass: !duplicateOf });

// ============================================================
// CATEGORY - deterministic keyword map over vendor + items.
// The LLM hint is recorded but code decides.
// ============================================================
const CAT_MAP = [
  ['meals & dining', /restaurant|cafe|coffee|bakery|kitchen|grill|pizza|burger|hotel.|catering|food/i],
  ['fuel', /fuel|petrol|gas station|diesel|woqod/i],
  ['transport', /taxi|uber|careem|karwa|transport|rental|parking|metro/i],
  ['accommodation', /hotel|resort|suite|inn|motel/i],
  ['office supplies', /stationery|office|paper|print|copy|supplies|ink|toner/i],
  ['electronics', /electronics|computer|laptop|printer|monitor|keyboard|mobile|phone|camera/i],
  ['telecom', /telecom|etisalat|ooredoo|vodafone|mobile data|internet/i],
  ['utilities', /electric|water|utility|electricity|kahramaa/i],
  ['software & subscriptions', /software|subscription|saas|license|cloud|microsoft|adobe|google/i],
  ['medical', /pharmacy|medical|clinic|hospital|dental/i]
];
let category = 'other';
const haystack = (extracted.vendor ?? '') + ' ' + extracted.line_items.map(li => li.description).join(' ');
for (const [cat, re] of CAT_MAP) { if (re.test(haystack)) { category = cat; break; } }
if (category === 'other' && extracted.category_hint) {
  const known = CAT_MAP.map(c => c[0]);
  const guess = known.find(k => extracted.category_hint.includes(k.split(' ')[0]));
  if (guess) category = guess;
}

// decision
const hasReviewFlags = flags.some(f => !f.startsWith('duplicate of'));
let status, decision;
if (duplicateOf) { status = 'duplicate'; decision = 'skip'; }
else if (hasReviewFlags || extracted.image_quality === 'poor') { status = 'needs_review'; decision = 'log'; }
else { status = 'valid'; decision = 'log'; }

const now = new Date();
const expenseId = 'EXP-' + now.toISOString().slice(0,10).replace(/-/g,'') + '-' + now.toTimeString().slice(0,8).replace(/:/g,'');

return [{ json: {
  decision, status, category,
  expense_id: expenseId,
  duplicate_of: duplicateOf,
  extracted, checks, flags,
  request: ctx.request, log_size: ctx.log_size,
  submitted_by: ctx.request.submitted_by
}}];`,
    };

    @node({
        id: 'rv000001-0007-4b2c-9d3e-rv0000000007',
        name: 'IF Log Worthy',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [180, 0],
    })
    IfLogWorthy = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'c-log',
                    leftValue: "={{ $json.decision === 'log' }}",
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'rv000001-0008-4b2c-9d3e-rv0000000008',
        name: 'Append Expense',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [400, -140],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    AppendExpense = {
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
            value: 'Expenses',
        },
        columns: {
            mappingMode: 'autoMapInputData',
            matchingColumns: [],
            schema: [],
        },
        options: {},
    };

    @node({
        id: 'rv000001-0009-4b2c-9d3e-rv0000000009',
        name: 'Shape Log Row',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [400, -300],
    })
    ShapeLogRow = {
        mode: 'runOnceForEachItem',
        jsCode: `// shape one clean row for the Sheets log
const v = $json;
return {
  json: {
    expense_id: v.expense_id,
    vendor: v.extracted?.vendor ?? '',
    receipt_number: v.extracted?.receipt_number ?? '',
    date: v.extracted?.date ?? '',
    currency: v.extracted?.currency ?? '',
    category: v.category ?? 'other',
    subtotal: v.extracted?.subtotal ?? '',
    tax: v.extracted?.tax ?? '',
    total: v.extracted?.total ?? '',
    items_count: v.extracted?.line_items?.length ?? 0,
    status: v.status,
    flags: (v.flags || []).join('; '),
    submitted_by: v.submitted_by,
    logged_at: new Date().toISOString()
  }
};`,
    };

    @node({
        id: 'rv000001-0010-4b2c-9d3e-rv0000000010',
        name: 'Build Expense Response',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [640, 0],
    })
    BuildExpenseResponse = {
        jsCode: `// assemble the final API response - decision path is fully deterministic
const v = $('Validate Receipt').item.json;
const logged = $execution.nodeExecuted ?? null;
const payload = {
  status: v.status,
  expense_id: v.decision === 'log' ? v.expense_id : null,
  category: v.decision === 'log' ? v.category : null,
  extracted: v.extracted,
  validation: { checks: v.checks, flags: v.flags },
  duplicate_of: v.duplicate_of,
  logged_to_sheet: v.decision === 'log',
  stats: { expenses_on_file: v.log_size },
  engine: {
    vision_extraction: 'groq qwen/qwen3.8-27b (temp 0.1, strict JSON)',
    validation: 'deterministic finance checks in code (math, date, duplicate hash)',
    category: 'deterministic keyword map in code - LLM hint recorded only',
    storage: 'google sheets Expenses log'
  }
};
if (v.parse_error) payload.parse_error = v.parse_error;
if (v.vision_error) payload.vision_error = v.vision_error;
return [{ json: payload }];`,
    };

    @node({
        id: 'rv000001-0011-4b2c-9d3e-rv0000000011',
        name: 'Return Expense Response',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [860, 0],
    })
    ReturnExpenseResponse = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify($json) }}',
    };

    @node({
        id: 'rv000001-0020-4b2c-9d3e-rv0000000020',
        webhookId: 'expense-digest-hook-01',
        name: 'Digest Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-1140, 400],
        notes: 'Manual/remote digest trigger - same pipeline the cron uses.',
    })
    DigestHook = {
        httpMethod: 'POST',
        path: 'expense-digest',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'rv000001-0021-4b2c-9d3e-rv0000000021',
        name: 'Monthly Cron',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [-1140, 560],
        notes: '1st of every month 07:00 - sends the digest automatically.',
    })
    MonthlyCron = {
        rule: {
            interval: [
                {
                    field: 'cron',
                    expression: '0 7 1 * *',
                },
            ],
        },
    };

    @node({
        id: 'rv000001-0022-4b2c-9d3e-rv0000000022',
        name: 'Read Expenses Digest',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-920, 480],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 8000,
    })
    ReadExpensesDigest = {
        resource: 'sheet',
        operation: 'read',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Expenses',
        },
        options: {},
    };

    @node({
        id: 'rv000001-0023-4b2c-9d3e-rv0000000023',
        name: 'Aggregate Month',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-700, 480],
    })
    AggregateMonth = {
        jsCode: `// ============================================================
// MONTHLY AGGREGATOR - deterministic grouping over the log.
// The digest numbers are computed HERE, never by the LLM.
// ============================================================
const rows = $input.all().map(i => i.json).filter(r => r && r.expense_id && String(r.expense_id).trim() !== '');
const cutoff = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
const window = rows.filter(r => (r.date ?? '') >= cutoff);
const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);

const cats = {};
const vendors = {};
let grand = 0, flagged = 0, nonQar = 0;
for (const r of window) {
  const t = num(r.total);
  const c = r.category || 'other';
  if (t !== null) {
    (cats[c] = cats[c] || { category: c, sum: 0, count: 0 });
    cats[c].sum = Math.round((cats[c].sum + t) * 100) / 100;
    cats[c].count += 1;
    grand = Math.round((grand + t) * 100) / 100;
  }
  const v = (r.vendor || 'unknown').toLowerCase().trim();
  vendors[v] = (vendors[v] || 0) + 1;
  if ((r.status ?? '') !== 'valid') flagged += 1;
  if ((r.currency ?? 'QAR') !== 'QAR') nonQar += 1;
}
const categories = Object.values(cats).sort((a, b) => b.sum - a.sum);
const topVendors = Object.entries(vendors).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => ({ vendor: v, receipts: n }));
return [{ json: {
  window: { from: cutoff, to: new Date().toISOString().slice(0, 10) },
  receipts_count: window.length,
  grand_total: grand,
  flagged_count: flagged,
  non_qar_count: nonQar,
  categories,
  top_vendors: topVendors
}}];`,
    };

    @node({
        id: 'rv000001-0024-4b2c-9d3e-rv0000000024',
        name: 'Draft Digest',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-480, 480],
        credentials: { groqApi: { id: '6VUycnVaIxEH5YXv', name: 'Groq account' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    DraftDigest = {
        method: 'POST',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'groqApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ model: 'openai/gpt-oss-120b', temperature: 0.2, max_tokens: 350, messages: [ { role: 'system', content: \"You write a short monthly expense digest for a business owner in Doha, Qatar. Use ONLY the numbers in DIGEST DATA - never invent, round or estimate numbers. 3-4 sentences: overall spend, biggest category, anything flagged for review, and one practical observation. Plain business English, no markdown, no bullet points.\" }, { role: 'user', content: 'DIGEST DATA: ' + JSON.stringify($json) + '\\n\\nWrite the digest text now.' } ] }) }}",
        options: {
            timeout: 60000,
        },
    };

    @node({
        id: 'rv000001-0025-4b2c-9d3e-rv0000000025',
        name: 'Build Digest Email',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-260, 480],
    })
    BuildDigestEmail = {
        jsCode: `// build the digest email deterministically - LLM text is one paragraph inside it
const agg = $('Aggregate Month').item.json;
let summary = '';
try { summary = String($json.choices[0].message.content).trim(); } catch (e) { summary = 'Digest summary unavailable this run.'; }
const money = n => (typeof n === 'number' ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(n ?? '-'));
const catRows = agg.categories.map(c =>
  '<tr><td style="padding:8px 12px;border:1px solid #d9e2ec;">' + c.category + '</td>' +
  '<td style="padding:8px 12px;border:1px solid #d9e2ec;text-align:right;">' + money(c.sum) + ' QAR</td>' +
  '<td style="padding:8px 12px;border:1px solid #d9e2ec;text-align:center;">' + c.count + '</td></tr>'
).join('');
const vendorCells = agg.top_vendors.map(v => '<li>' + v.vendor + ' - ' + v.receipts + ' receipts</li>').join('');
const flaggedNote = agg.flagged_count > 0
  ? '<p style="color:#b45309;font-weight:600;">&#9888; ' + agg.flagged_count + ' receipt(s) flagged for review during this window.</p>'
  : '<p style="color:#15803d;">No receipts flagged for review in this window.</p>';
const html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;">' +
  '<h2 style="color:#1e3a5f;">Monthly Expense Digest</h2>' +
  '<p style="color:#475569;">Window: ' + agg.window.from + ' to ' + agg.window.to + '</p>' +
  '<p>' + summary.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</p>' +
  '<table style="border-collapse:collapse;font-size:14px;">' +
  '<tr><th style="padding:8px 12px;border:1px solid #b6c2cf;background:#eef3f8;text-align:left;">Category</th>' +
  '<th style="padding:8px 12px;border:1px solid #b6c2cf;background:#eef3f8;text-align:right;">Total (QAR)</th>' +
  '<th style="padding:8px 12px;border:1px solid #b6c2cf;background:#eef3f8;">Receipts</th></tr>' +
  (catRows || '<tr><td colspan="3" style="padding:8px 12px;border:1px solid #d9e2ec;">No expenses logged in this window.</td></tr>') +
  '</table>' +
  '<p style="margin-top:12px;"><b>Grand total: ' + money(agg.grand_total) + ' QAR</b> across ' + agg.receipts_count + ' receipt(s).</p>' +
  (agg.top_vendors.length ? '<p><b>Top vendors:</b><ul>' + vendorCells + '</ul></p>' : '') +
  flaggedNote +
  (agg.non_qar_count > 0 ? '<p style="color:#64748b;font-size:12px;">Note: ' + agg.non_qar_count + ' receipt(s) in non-QAR currency (shown unconverted).</p>' : '') +
  '<hr style="border:none;border-top:1px solid #d9e2ec;margin-top:18px;">' +
  '<p style="color:#94a3b8;font-size:11px;">Automated by Receipt &amp; Expense Tracker - Vision AI (n8n). Numbers computed deterministically from the Expenses log.</p>' +
  '</div>';
return [{ json: {
  subject: 'Monthly Expense Digest - ' + agg.window.from + ' to ' + agg.window.to + ' (' + money(agg.grand_total) + ' QAR)',
  html, receipts_count: agg.receipts_count, grand_total: agg.grand_total
}}];`,
    };

    @node({
        id: 'rv000001-0026-4b2c-9d3e-rv0000000026',
        webhookId: '965dcf41-81e8-4022-a104-df8c74b88a16',
        name: 'Send Digest Email',
        type: 'n8n-nodes-base.gmail',
        version: 2.2,
        position: [-40, 480],
        credentials: { gmailOAuth2: { id: 'qiWG3HHdsA8yi4uD', name: 'Gmail account' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 8000,
    })
    SendDigestEmail = {
        resource: 'message',
        operation: 'send',
        sendTo: 'haxanakhtarqtr@gmail.com',
        subject: '={{ $json.subject }}',
        emailType: 'html',
        message: '={{ $json.html }}',
        options: {},
    };

    @node({
        id: 'rv000001-0027-4b2c-9d3e-rv0000000027',
        name: 'Respond Digest',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [180, 480],
    })
    RespondDigest = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ digest_sent: true, subject: $('Build Digest Email').item.json.subject, receipts_count: $('Build Digest Email').item.json.receipts_count, grand_total: $('Build Digest Email').item.json.grand_total, emailed_to: 'haxanakhtarqtr@gmail.com', gmail_result: $json }) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ReceiptHook.out(0).to(this.ReadExpenses.in(0));
        this.ReceiptHook.out(0).to(this.EnsureExpensesTab.in(0));
        this.ReadExpenses.out(0).to(this.BuildContext.in(0));
        this.BuildContext.out(0).to(this.AnalyzeReceipt.in(0));
        this.AnalyzeReceipt.out(0).to(this.ValidateReceipt.in(0));
        this.ValidateReceipt.out(0).to(this.IfLogWorthy.in(0));
        this.IfLogWorthy.out(0).to(this.ShapeLogRow.in(0));
        this.IfLogWorthy.out(1).to(this.BuildExpenseResponse.in(0));
        this.ShapeLogRow.out(0).to(this.AppendExpense.in(0));
        this.AppendExpense.out(0).to(this.BuildExpenseResponse.in(0));
        this.BuildExpenseResponse.out(0).to(this.ReturnExpenseResponse.in(0));
        this.DigestHook.out(0).to(this.ReadExpensesDigest.in(0));
        this.MonthlyCron.out(0).to(this.ReadExpensesDigest.in(0));
        this.ReadExpensesDigest.out(0).to(this.AggregateMonth.in(0));
        this.AggregateMonth.out(0).to(this.DraftDigest.in(0));
        this.DraftDigest.out(0).to(this.BuildDigestEmail.in(0));
        this.BuildDigestEmail.out(0).to(this.SendDigestEmail.in(0));
        this.SendDigestEmail.out(0).to(this.RespondDigest.in(0));
    }
}
