import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Ask Your Data - NL Analytics Agent
// Nodes   : 10  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AskDataHook                        webhook
// LoadSalesOrders                    googleSheets               [onError→regular] [creds] [alwaysOutput] [retry]
// BuildCatalog                       code
// PlanQuery                          httpRequest                [creds] [retry]
// ValidatePlan                       code
// ExecutePlan                        code
// IfPlanValid                        if
// PhraseAnswer                       httpRequest                [creds] [retry]
// BuildDataAnswer                    code
// ReturnDataAnswer                   respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// AskDataHook
//    → LoadSalesOrders
//      → BuildCatalog
//        → PlanQuery
//          → ValidatePlan
//            → ExecutePlan
//              → IfPlanValid
//                → PhraseAnswer
//                  → BuildDataAnswer
//                    → ReturnDataAnswer
//               .out(1) → BuildDataAnswer (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'OykKT14mE89dUWrK',
    name: 'Ask Your Data - NL Analytics Agent',
    active: true,
    isArchived: false,
    projectId: 'WkdztVBhxnc914pU',
})
export class AskYourDataNlAnalyticsAgentWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'ad000001-0001-4b2c-9d3e-ask0000000001',
        webhookId: 'ask-data-hook-01',
        name: 'Ask Data Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-1080, 0],
        notes: 'Query entry: POST { question }. Demo front-end and any client can ask.',
    })
    AskDataHook = {
        httpMethod: 'POST',
        path: 'ask-data',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'ad000001-0002-4b2c-9d3e-ask0000000002',
        name: 'Load Sales Orders',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-860, 0],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    LoadSalesOrders = {
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
            value: 'Sales_Orders',
        },
        options: {},
    };

    @node({
        id: 'ad000001-0003-4b2c-9d3e-ask0000000003',
        name: 'Build Catalog',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-640, 0],
    })
    BuildCatalog = {
        jsCode: `// ============================================================
// SCHEMA CATALOG BUILDER - infers schema, normalizes values and
// adds schema-linking metadata: field descriptions, real date
// ranges and distinct values for string fields. This metadata
// (never raw rows) is all the LLM planner sees.
// ============================================================
const FIELD_DOCS = {
  order_id: 'unique order number (SO-xxxx)',
  customer: 'buying company name',
  product: 'product name sold',
  qty: 'units sold',
  unit_price_qar: 'price per unit in QAR',
  total_qar: 'line total in QAR (qty x unit price)',
  status: 'order status: Delivered, Pending or Cancelled',
  order_date: 'date the order was placed (YYYY-MM-DD)',
  rep: 'sales representative person name (not the customer)'
};

const raw = $input.all().map(i => i.json).filter(r => r && Object.keys(r).length);
if (!raw.length) {
  return [{ json: { catalog: { table: 'Sales_Orders', row_count: 0, fields: [] }, rows: [] } }];
}
const sample = raw[0];
const fields = Object.keys(sample).map(k => {
  const snake = k.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const vals = raw.map(r => r[k]).filter(v => v !== null && v !== undefined && v !== '');
  const numeric = vals.length > 0 && vals.every(v => !isNaN(Number(v)));
  const isDate = !numeric && vals.length > 0 && vals.every(v => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(v)));
  const out = { name: snake, source: k, type: numeric ? 'number' : (isDate ? 'date' : 'string') };
  if (FIELD_DOCS[snake]) out.description = FIELD_DOCS[snake];
  if (isDate) {
    const sorted = vals.map(v => String(v)).sort();
    out.date_range = [sorted[0], sorted[sorted.length - 1]];
  }
  if (out.type === 'string') {
    const distinct = [...new Set(vals.map(v => String(v)))].sort();
    out.distinct_values = distinct.slice(0, 15);
  }
  return out;
});
const rows = raw.map(r => {
  const o = {};
  for (const f of fields) {
    const v = r[f.source];
    if (f.type === 'number') o[f.name] = (v === '' || v === null || v === undefined) ? null : Number(v);
    else o[f.name] = (v === null || v === undefined) ? '' : String(v);
  }
  return o;
});
const pubFields = fields.map(f => {
  const o = { name: f.name, type: f.type };
  if (f.description) o.description = f.description;
  if (f.date_range) o.date_range = f.date_range;
  if (f.distinct_values) o.distinct_values = f.distinct_values;
  return o;
});
return [{ json: {
  catalog: { table: 'Sales_Orders', row_count: rows.length, fields: pubFields },
  rows
}}];`,
    };

    @node({
        id: 'ad000001-0004-4b2c-9d3e-ask0000000004',
        name: 'Plan Query',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-420, 0],
        credentials: { groqApi: { id: '6VUycnVaIxEH5YXv', name: 'Groq account' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    PlanQuery = {
        method: 'POST',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'groqApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ model: \'openai/gpt-oss-120b\', temperature: 0.1, max_tokens: 600, response_format: { type: \'json_object\' }, messages: [ { role: \'system\', content: "You translate a business question about a spreadsheet into ONE strict JSON query plan. You NEVER see the data itself - only the SCHEMA metadata. Output ONLY the JSON object.\\n\\nPLAN SCHEMA:\\n{\\"filter\\": [ {\\"field\\": \\"<field>\\", \\"op\\": \\"<op>\\", \\"value\\": <value>} ] , \\"group_by\\": \\"<field>\\" or null, \\"aggregate\\": {\\"op\\": \\"<agg>\\", \\"field\\": \\"<field or null>\\"} , \\"sort\\": {\\"field\\": \\"<field or aggregate>\\", \\"order\\": \\"asc\\" or \\"desc\\"} or null, \\"limit\\": <int 1-20> , \\"select\\": [\\"<field>\\", ...] or null}\\n\\nRULES:\\n- filter ops: number/date fields -> eq, ne, gt, gte, lt, lte, between (between value = [a,b]). string fields -> eq, ne, contains, starts_with, in (in value = [list]).\\n- aggregate op: sum, avg, min, max (numeric field) or count (field null = count rows).\\n- group_by: single field or null. When grouping, aggregate runs per group and result rows are {\\"group\\": key, \\"value\\": number}.\\n- Without aggregate: plan is a row listing (use select to limit columns, sort + limit apply).\\n- sort.field \\"aggregate\\" means sort by the aggregate value. Default sort when grouping: aggregate desc.\\n- SCHEMA LINKING: read each field description and distinct_values carefully. Pick the field whose description matches the question. Spell filter values EXACTLY as they appear in distinct_values (e.g. a person name belongs to the field whose distinct_values contain it).\\n- Date fields carry their real min/max date_range - plan date filters INSIDE that actual range (use the real years shown).\\n- UNANSWERABLE: if the question is unrelated to the SCHEMA fields and cannot be expressed as any query over this dataset, output {\\"unanswerable\\": true, \\"reason\\": \\"<short why>\\"} and nothing else.\\n\\nEXAMPLES:\\nQ: total revenue? -> {\\"filter\\": [], \\"group_by\\": null, \\"aggregate\\": {\\"op\\": \\"sum\\", \\"field\\": \\"total_qar\\"}, \\"sort\\": null, \\"limit\\": 1, \\"select\\": null}\\nQ: top 3 customers by revenue -> {\\"filter\\": [], \\"group_by\\": \\"customer\\", \\"aggregate\\": {\\"op\\": \\"sum\\", \\"field\\": \\"total_qar\\"}, \\"sort\\": {\\"field\\": \\"aggregate\\", \\"order\\": \\"desc\\"}, \\"limit\\": 3, \\"select\\": null}\\nQ: pending orders above 5000 -> {\\"filter\\": [{\\"field\\": \\"status\\", \\"op\\": \\"eq\\", \\"value\\": \\"Pending\\"}, {\\"field\\": \\"total_qar\\", \\"op\\": \\"gt\\", \\"value\\": 5000}], \\"group_by\\": null, \\"aggregate\\": null, \\"sort\\": {\\"field\\": \\"total_qar\\", \\"order\\": \\"desc\\"}, \\"limit\\": 20, \\"select\\": [\\"order_id\\", \\"customer\\", \\"total_qar\\"]}\\nQ: orders in November -> use between with the actual November dates from the SCHEMA date_range years" }, { role: \'user\', content: \'SCHEMA: \' + JSON.stringify($(\'Build Catalog\').item.json.catalog) + \'\\n\\nQUESTION: \' + (($(\'Ask Data Hook\').item.json.body && $(\'Ask Data Hook\').item.json.body.question) || $(\'Ask Data Hook\').item.json.question || \'\') } ] }) }}',
        options: {
            timeout: 60000,
        },
    };

    @node({
        id: 'ad000001-0005-4b2c-9d3e-ask0000000005',
        name: 'Validate Plan',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-200, 0],
    })
    ValidatePlan = {
        jsCode: `// ============================================================
// PLAN VALIDATOR - whitelists every field, operator and value.
// Honors the planner's unanswerable verdict; a plan the code
// cannot trust never reaches the executor.
// ============================================================
const hook = $('Ask Data Hook').item.json;
const question = (hook.body && hook.body.question) || hook.question || '';

let plan;
try {
  let txt = String(($json.choices || [])[0]?.message?.content ?? '');
  txt = txt.replace(/\\\`\\\`\\\`json|\\\`\\\`\\\`/g, '').trim();
  plan = JSON.parse(txt);
} catch (e) {
  return [{ json: { valid: false, reasons: ['plan JSON unparseable: ' + e.message], question } }];
}

if (plan.unanswerable) {
  return [{ json: { valid: false, reasons: ['planner: ' + (plan.reason || 'question is unrelated to this dataset')], question } }];
}

const catalogItem = $('Build Catalog').item.json;
const reasons = [];
const fmap = {};
for (const f of catalogItem.catalog.fields) fmap[f.name] = f;
const norm = s => String(s === null || s === undefined ? '' : s).toLowerCase().trim();
const OPS = { number: ['eq','ne','gt','gte','lt','lte','between'], date: ['eq','ne','gt','gte','lt','lte','between'], string: ['eq','ne','contains','starts_with','in'] };
const AGG = ['sum','avg','min','max','count'];

const rawFilters = Array.isArray(plan.filter) ? plan.filter : (plan.filter ? [plan.filter] : []);
const filters = [];
for (const f of rawFilters) {
  const field = norm(f.field), op = norm(f.op);
  const fd = fmap[field];
  if (!fd) { reasons.push('unknown filter field: ' + f.field); continue; }
  if (!OPS[fd.type].includes(op)) { reasons.push('operator ' + op + ' not allowed on ' + field + ' (' + fd.type + ')'); continue; }
  let value = f.value;
  if (fd.type === 'number') value = Number(value);
  if (fd.type === 'number' && isNaN(value)) { reasons.push('filter value on ' + field + ' is not a number'); continue; }
  if (op === 'between' && (!Array.isArray(value) || value.length !== 2)) { reasons.push('between needs a 2-value array on ' + field); continue; }
  filters.push({ field, op, value });
}

let groupBy = null;
if (plan.group_by !== null && plan.group_by !== undefined && plan.group_by !== '') {
  groupBy = norm(plan.group_by);
  if (!fmap[groupBy]) reasons.push('unknown group_by field: ' + plan.group_by);
}

let aggregate = null;
if (plan.aggregate && plan.aggregate.op) {
  const op = norm(plan.aggregate.op);
  if (!AGG.includes(op)) reasons.push('unknown aggregate op: ' + plan.aggregate.op);
  else {
    const fld = norm(plan.aggregate.field);
    if (op === 'count') aggregate = { op: 'count', field: null };
    else if (!fld || !fmap[fld]) { if (fld) reasons.push('unknown aggregate field: ' + plan.aggregate.field); else reasons.push('aggregate ' + op + ' needs a numeric field'); }
    else if (fmap[fld].type !== 'number') reasons.push('aggregate field ' + fld + ' is not numeric');
    else aggregate = { op, field: fld };
  }
}

let sort = null;
if (plan.sort && plan.sort.field) {
  const fld = norm(plan.sort.field);
  const order = norm(plan.sort.order) === 'asc' ? 'asc' : 'desc';
  if (fld !== 'aggregate' && !fmap[fld]) reasons.push('unknown sort field: ' + plan.sort.field);
  else sort = { field: fld, order };
}

let limit = Number(plan.limit);
if (!limit || limit < 1) limit = 10;
if (limit > 20) { reasons.push('limit above 20 not allowed'); limit = 20; }

let select = null;
if (Array.isArray(plan.select) && plan.select.length) {
  const clean = [];
  for (const s of plan.select) { const fld = norm(s); if (!fmap[fld]) reasons.push('unknown select field: ' + s); else clean.push(fld); }
  select = clean.length ? clean : null;
}

if (reasons.length) return [{ json: { valid: false, reasons, question } }];
return [{ json: { valid: true, plan: { filters, group_by: groupBy, aggregate, sort, limit, select }, question } }];`,
    };

    @node({
        id: 'ad000001-0006-4b2c-9d3e-ask0000000006',
        name: 'Execute Plan',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [20, 0],
    })
    ExecutePlan = {
        jsCode: `// ============================================================
// PLAN EXECUTOR - pure deterministic JS. The numbers in the
// answer come from HERE, never from the LLM.
// ============================================================
const item = $json;
if (!item.valid) {
  return [{ json: { plan_rejected: true, reasons: item.reasons, question: item.question } }];
}
const plan = item.plan;
const rows = $('Build Catalog').item.json.rows;

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const applyFilter = (r, f) => {
  const v = r[f.field], t = f.value;
  if (f.op === 'between') return v >= t[0] && v <= t[1];
  switch (f.op) {
    case 'eq': return String(v).toLowerCase() === String(t).toLowerCase();
    case 'ne': return String(v).toLowerCase() !== String(t).toLowerCase();
    case 'gt': return cmp(v, t) > 0;
    case 'gte': return cmp(v, t) >= 0;
    case 'lt': return cmp(v, t) < 0;
    case 'lte': return cmp(v, t) <= 0;
    case 'contains': return String(v).toLowerCase().includes(String(t).toLowerCase());
    case 'starts_with': return String(v).toLowerCase().startsWith(String(t).toLowerCase());
    case 'in': return Array.isArray(t) && t.map(x => String(x).toLowerCase()).includes(String(v).toLowerCase());
    default: return false;
  }
};

let filtered = rows;
for (const f of plan.filters) filtered = filtered.filter(r => applyFilter(r, f));

const round2 = n => Math.round(n * 100) / 100;
const aggValue = (rs, agg) => {
  if (!agg) return null;
  if (agg.op === 'count') return rs.length;
  const vals = rs.map(r => r[agg.field]).filter(v => v !== null && v !== undefined && !isNaN(v));
  if (!vals.length) return null;
  if (agg.op === 'sum') return round2(vals.reduce((s, v) => s + v, 0));
  if (agg.op === 'avg') return round2(vals.reduce((s, v) => s + v, 0) / vals.length);
  if (agg.op === 'min') return Math.min(...vals);
  if (agg.op === 'max') return Math.max(...vals);
  return null;
};

let result_rows, computed = null;
if (plan.aggregate && plan.group_by) {
  const groups = {};
  for (const r of filtered) { const k = String(r[plan.group_by]); (groups[k] = groups[k] || []).push(r); }
  result_rows = Object.entries(groups).map(([k, rs]) => ({ group: k, value: aggValue(rs, plan.aggregate) }));
  const order = plan.sort && plan.sort.field === 'aggregate' ? plan.sort.order : 'desc';
  result_rows.sort((a, b) => order === 'asc' ? cmp(a.value, b.value) : cmp(b.value, a.value));
  result_rows = result_rows.slice(0, plan.limit);
  computed = result_rows.length ? result_rows[0].value : null;
} else if (plan.aggregate) {
  const v = aggValue(filtered, plan.aggregate);
  computed = v;
  result_rows = [{ value: v }];
} else {
  let out = filtered.map(r => plan.select ? Object.fromEntries(plan.select.map(s => [s, r[s]])) : r);
  if (plan.sort && plan.sort.field !== 'aggregate') out.sort((a, b) => plan.sort.order === 'asc' ? cmp(a[plan.sort.field], b[plan.sort.field]) : cmp(b[plan.sort.field], a[plan.sort.field]));
  result_rows = out.slice(0, plan.limit);
}

return [{ json: {
  valid: true,
  question: item.question,
  plan,
  result_rows,
  stats: { rows_scanned: rows.length, rows_matched: filtered.length, groups_returned: plan.group_by ? result_rows.length : null },
  computed
}}];`,
    };

    @node({
        id: 'ad000001-0007-4b2c-9d3e-ask0000000007',
        name: 'IF Plan Valid',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [240, 0],
    })
    IfPlanValid = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'c-valid',
                    leftValue: '={{ $json.valid }}',
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
        id: 'ad000001-0008-4b2c-9d3e-ask0000000008',
        name: 'Phrase Answer',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [460, -140],
        credentials: { groqApi: { id: '6VUycnVaIxEH5YXv', name: 'Groq account' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    PhraseAnswer = {
        method: 'POST',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'groqApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ model: 'openai/gpt-oss-120b', temperature: 0.2, max_tokens: 350, messages: [ { role: 'system', content: \"You explain the result of a deterministic data query in natural business English. Use ONLY the numbers that appear in RESULT JSON - never invent, round, or estimate numbers. If RESULT is empty, say no matching rows were found. 1-3 short sentences. Mention the aggregation used (e.g. sum of total_qar).\" }, { role: 'user', content: 'QUESTION: ' + $json.question + '\\n\\nPLAN: ' + JSON.stringify($json.plan) + '\\n\\nRESULT: ' + JSON.stringify({ result_rows: $json.result_rows, stats: $json.stats }) } ] }) }}",
        options: {
            timeout: 60000,
        },
    };

    @node({
        id: 'ad000001-0009-4b2c-9d3e-ask0000000009',
        name: 'Build Data Answer',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [680, 0],
    })
    BuildDataAnswer = {
        jsCode: `// assemble the final response - rejection path is fully deterministic
const exec = $('Execute Plan').item.json;
if (exec.plan_rejected) {
  return [{ json: {
    status: 'plan_rejected',
    question: exec.question,
    answer: 'This question cannot be answered from the Sales_Orders dataset.',
    reasons: exec.reasons,
    engine: { planner: 'groq/gpt-oss-120b (temp 0.1, strict JSON plan)', validator: 'deterministic whitelist validation in code', executor: 'deterministic plan engine in auditable code' }
  }}];
}
let answer = '';
try { answer = String($json.choices[0].message.content).trim(); } catch (e) {}
if (!answer) answer = 'Answer phrasing failed - see result_rows for the computed values.';
return [{ json: {
  status: 'answered',
  question: exec.question,
  answer,
  plan: exec.plan,
  result_rows: exec.result_rows,
  stats: exec.stats,
  engine: { planner: 'groq/gpt-oss-120b (temp 0.1, strict JSON plan)', validator: 'deterministic whitelist validation in code', executor: 'deterministic plan engine in auditable code', phrasing: 'groq/gpt-oss-120b (temp 0.2, grounded on computed numbers)' }
}}];`,
    };

    @node({
        id: 'ad000001-0010-4b2c-9d3e-ask0000000010',
        name: 'Return Data Answer',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [900, 0],
    })
    ReturnDataAnswer = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify($json) }}',
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.AskDataHook.out(0).to(this.LoadSalesOrders.in(0));
        this.LoadSalesOrders.out(0).to(this.BuildCatalog.in(0));
        this.BuildCatalog.out(0).to(this.PlanQuery.in(0));
        this.PlanQuery.out(0).to(this.ValidatePlan.in(0));
        this.ValidatePlan.out(0).to(this.ExecutePlan.in(0));
        this.ExecutePlan.out(0).to(this.IfPlanValid.in(0));
        this.IfPlanValid.out(0).to(this.PhraseAnswer.in(0));
        this.IfPlanValid.out(1).to(this.BuildDataAnswer.in(0));
        this.PhraseAnswer.out(0).to(this.BuildDataAnswer.in(0));
        this.BuildDataAnswer.out(0).to(this.ReturnDataAnswer.in(0));
    }
}
