import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Daily AI Briefing - Morning Agent
// Nodes   : 16  |  Connections: 21
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// MorningCron                        scheduleTrigger
// BriefingHook                       webhook
// ReadTasks                          googleSheets               [onError→regular] [creds] [alwaysOutput] [retry]
// ReadExpenses                       googleSheets               [onError→regular] [creds] [alwaysOutput] [retry]
// ReadSalesOrders                    googleSheets               [onError→regular] [creds] [alwaysOutput] [retry]
// Weather                            httpRequest                [onError→regular] [alwaysOutput]
// TagTasks                           code
// TagExpenses                        code
// TagOrders                          code
// TagWeather                         code
// ComputeBriefing                    code
// DraftDigest                        httpRequest                [onError→regular] [creds] [alwaysOutput] [retry]
// AssembleBriefing                   code
// SendBriefingEmail                  gmail                      [creds] [retry]
// RespondBriefing                    respondToWebhook           [onError→regular] [alwaysOutput]
// MergeFeeds                         merge
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// MorningCron
//    → ReadTasks
//      → TagTasks
//        → MergeFeeds
//          → ComputeBriefing
//            → DraftDigest
//              → AssembleBriefing
//                → SendBriefingEmail
//                  → RespondBriefing
//    → ReadExpenses
//      → TagExpenses
//        → MergeFeeds.in(1) (↩ loop)
//    → ReadSalesOrders
//      → TagOrders
//        → MergeFeeds.in(2) (↩ loop)
//    → Weather
//      → TagWeather
//        → MergeFeeds.in(3) (↩ loop)
// BriefingHook
//    → ReadTasks (↩ loop)
//    → ReadExpenses (↩ loop)
//    → ReadSalesOrders (↩ loop)
//    → Weather (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'yPuwhBhNqdqpWiuC',
    name: 'Daily AI Briefing - Morning Agent',
    active: true,
    isArchived: false,
    projectId: 'WkdztVBhxnc914pU',
    settings: { timezone: 'Asia/Qatar', executionOrder: 'v1' },
})
export class DailyAiBriefingMorningAgentWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'db000001-0001-4b2c-9d3e-db0000000001',
        name: 'Morning Cron',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [-1340, 0],
        notes: 'Daily 07:00 Asia/Qatar (workflow timezone). Fires the briefing automatically.',
    })
    MorningCron = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 7 * * *',
                },
            ],
        },
    };

    @node({
        id: 'db000001-0002-4b2c-9d3e-db0000000002',
        webhookId: 'daily-briefing-hook-01',
        name: 'Briefing Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-1340, 260],
        notes: 'Manual trigger / demo: POST /webhook/daily-briefing.',
    })
    BriefingHook = {
        httpMethod: 'POST',
        path: 'daily-briefing',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'db000001-0003-4b2c-9d3e-db0000000003',
        name: 'Read Tasks',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-1120, -260],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 8000,
    })
    ReadTasks = {
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
            value: 'Tasks',
        },
        options: {},
    };

    @node({
        id: 'db000001-0004-4b2c-9d3e-db0000000004',
        name: 'Read Expenses',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-1120, 0],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 8000,
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
        id: 'db000001-0005-4b2c-9d3e-db0000000005',
        name: 'Read Sales Orders',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-1120, 260],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 8000,
    })
    ReadSalesOrders = {
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
        id: 'db000001-0006-4b2c-9d3e-db0000000006',
        name: 'Weather',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-1120, 520],
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        notes: 'Open-Meteo - free, no API key. Doha coords.',
    })
    Weather = {
        method: 'GET',
        url: 'https://api.open-meteo.com/v1/forecast?latitude=25.2867&longitude=51.5333&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FQatar&forecast_days=1',
        options: {
            timeout: 20000,
            response: {
                response: {
                    neverError: true,
                    fullResponse: false,
                },
            },
        },
    };

    @node({
        id: 'db000001-0007-4b2c-9d3e-db0000000007',
        name: 'Tag Tasks',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-900, -260],
    })
    TagTasks = {
        mode: 'runOnceForEachItem',
        jsCode: `// tag each row with its source so the compute node can group them
return { json: { brief_source: 'tasks', row: $json } };`,
    };

    @node({
        id: 'db000001-0008-4b2c-9d3e-db0000000008',
        name: 'Tag Expenses',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-900, 0],
    })
    TagExpenses = {
        mode: 'runOnceForEachItem',
        jsCode: `// tag each row with its source so the compute node can group them
return { json: { brief_source: 'expenses', row: $json } };`,
    };

    @node({
        id: 'db000001-0009-4b2c-9d3e-db0000000009',
        name: 'Tag Orders',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-900, 260],
    })
    TagOrders = {
        mode: 'runOnceForEachItem',
        jsCode: `// tag each row with its source so the compute node can group them
return { json: { brief_source: 'orders', row: $json } };`,
    };

    @node({
        id: 'db000001-0010-4b2c-9d3e-db0000000010',
        name: 'Tag Weather',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-900, 520],
    })
    TagWeather = {
        mode: 'runOnceForEachItem',
        jsCode: `// tag each row with its source so the compute node can group them
return { json: { brief_source: 'weather', row: $json } };`,
    };

    @node({
        id: 'db000001-0011-4b2c-9d3e-db0000000011',
        name: 'Compute Briefing',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-680, 100],
    })
    ComputeBriefing = {
        jsCode: `// ============================================================
// BRIEFING COMPUTE - deterministic. Code counts and sums the
// logs; the AI only narrates these facts afterwards.
// ============================================================
const items = $input.all();
const by = {};
for (const it of items) {
  const src = it.json && it.json.brief_source;
  if (!src) continue;
  (by[src] = by[src] || []).push(it.json);
}
const rows = src => (by[src] || []).map(x => x.row ?? x);

const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\\-]/g, '')); return isFinite(n) ? n : 0; };
const pick = (r, keys) => { for (const k of keys) { if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') return r[k]; } return null; };
const today = new Date();
const todayIso = today.toISOString().slice(0, 10);
const month = todayIso.slice(0, 7);
const iso = d => d.toISOString().slice(0, 10);
const addDays = n => { const x = new Date(today); x.setDate(x.getDate() + n); return iso(x); };

// --- tasks ---
const tasks = rows('tasks').filter(r => r && (r.task_id || r.task_title));
const dueToday = tasks.filter(t => String(t.due_date ?? '') === todayIso);
const overdue = tasks.filter(t => t.due_date && String(t.due_date) < todayIso);
const dueSoon = tasks.filter(t => t.due_date && String(t.due_date) > todayIso && String(t.due_date) <= addDays(7));
const highPriority = tasks.filter(t => String(t.priority ?? '').toLowerCase() === 'high');

// --- expenses ---
const expenses = rows('expenses').filter(r => r && (r.vendor || r.receipt_no || r.expense_id));
const expTotal = r => num(pick(r, ['total', 'grand_total', 'total_qar', 'amount']));
const expDate = r => String(pick(r, ['logged_at', 'date', 'receipt_date']) ?? '');
const monthExpenses = expenses.filter(r => expDate(r).slice(0, 7) === month);
const flagged = expenses.filter(r => String(r.status ?? '').toLowerCase().includes('review'));

// --- sales orders ---
const orders = rows('orders').filter(r => r && (r.order_id || r.rep || r.customer));
const revTotal = r => num(pick(r, ['total_qar', 'revenue', 'total', 'amount', 'order_total', 'value']));
const repName = r => String(pick(r, ['rep', 'representative', 'sales_rep', 'agent']) ?? '');
const monthOrders = orders.filter(r => String(pick(r, ['order_date', 'date', 'created']) ?? '').slice(0, 7) === month);
const byRep = {};
for (const r of orders) { const rep = repName(r); if (!rep) continue; byRep[rep] = (byRep[rep] || 0) + revTotal(r); }
const topRep = Object.entries(byRep).sort((a, b) => b[1] - a[1])[0] || null;
const delivered = orders.filter(r => String(r.status ?? '').toLowerCase().includes('deliver'));

// --- weather (open-meteo) ---
const wRaw = (by.weather || [])[0] || {};
const w = wRaw.row || wRaw;
const WCODE = { 0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm' };
const weather = w && w.current ? {
  ok: true,
  temp_c: w.current.temperature_2m,
  wind_kmh: w.current.wind_speed_10m,
  text: WCODE[w.current.weather_code] ?? 'Weather code ' + w.current.weather_code,
  max_c: (w.daily && w.daily.temperature_2m_max ? w.daily.temperature_2m_max[0] : null),
  min_c: (w.daily && w.daily.temperature_2m_min ? w.daily.temperature_2m_min[0] : null),
  precip_mm: (w.daily && w.daily.precipitation_sum ? w.daily.precipitation_sum[0] : null)
} : { ok: false, text: 'weather unavailable' };

const facts = {
  date: todayIso,
  weather,
  tasks: {
    on_file: tasks.length,
    due_today: dueToday.map(t => (t.task_title || t.task_id) + (t.due_time ? ' at ' + t.due_time : '')),
    overdue: overdue.map(t => (t.task_title || t.task_id) + ' (was due ' + t.due_date + ')'),
    due_within_7_days: dueSoon.map(t => (t.task_title || t.task_id) + ' (due ' + t.due_date + ')'),
    high_priority_open: highPriority.map(t => t.task_title || t.task_id)
  },
  expenses: {
    receipts_on_file: expenses.length,
    this_month_total_qar: Math.round(monthExpenses.reduce((s, r) => s + expTotal(r), 0) * 100) / 100,
    this_month_count: monthExpenses.length,
    flagged_for_review: flagged.length
  },
  sales: {
    orders_on_file: orders.length,
    total_revenue_qar: Math.round(orders.reduce((s, r) => s + revTotal(r), 0) * 100) / 100,
    delivered_orders: delivered.length,
    delivered_revenue_qar: Math.round(delivered.reduce((s, r) => s + revTotal(r), 0) * 100) / 100,
    this_month_revenue_qar: Math.round(monthOrders.reduce((s, r) => s + revTotal(r), 0) * 100) / 100,
    this_month_orders: monthOrders.length,
    top_rep: topRep ? { name: topRep[0], revenue_qar: Math.round(topRep[1] * 100) / 100 } : null
  }
};

// data-source health - a dead sheet must never silently zero the numbers
const sources = {
  tasks: by.tasks ? 'ok' : 'missing',
  expenses: by.expenses ? 'ok' : 'missing',
  orders: by.orders ? 'ok' : 'missing',
  weather: weather.ok ? 'ok' : 'unavailable'
};

return [{ json: { facts, sources } }];`,
    };

    @node({
        id: 'db000001-0012-4b2c-9d3e-db0000000012',
        name: 'Draft Digest',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-440, 100],
        credentials: { groqApi: { id: '6VUycnVaIxEH5YXv', name: 'Groq account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
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
            "={{ JSON.stringify({ model: 'openai/gpt-oss-120b', temperature: 0.2, max_tokens: 500, response_format: { type: 'json_object' }, messages: [ { role: 'system', content: \"You write the commentary section of a morning email briefing for a business owner in Doha. You are given pre-computed FACTS as JSON - you MUST NOT invent, round, or estimate any number that is not in the facts. Output ONLY the JSON object: {\\\"lines\\\": [\\\"...\\\", \\\"...\\\"]}\\\\n\\\\nRULES:\\\\n- 4 to 6 short lines, one observation per line, plain text, no markdown.\\\\n- Reference ONLY numbers present in the facts. If a list in the facts is empty, you may note that nothing is due - but never invent a count.\\\\n- Mention the weather once if available.\\\\n- Practical, calm tone. No greetings, no sign-offs, no emojis.\" }, { role: 'user', content: 'FACTS: ' + JSON.stringify($json.facts) + '\\n\\nWrite the commentary lines now.' } ] }) }}",
        options: {
            timeout: 60000,
        },
    };

    @node({
        id: 'db000001-0013-4b2c-9d3e-db0000000013',
        name: 'Assemble Briefing',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-200, 100],
    })
    AssembleBriefing = {
        jsCode: `// ============================================================
// ASSEMBLE - merge facts + AI lines into the briefing payload
// and a Gmail-safe HTML email. If the AI digest is missing or
// unparseable, a deterministic fallback digest is built here.
// ============================================================
const c = $('Compute Briefing').item.json;
const facts = c.facts;
const sources = c.sources;
const lines = [];

let groqOk = false;
try {
  const txt = String(($json.choices || [])[0]?.message?.content ?? '');
  const parsed = JSON.parse(txt.replace(/\\\`\\\`\\\`json|\\\`\\\`\\\`/g, '').trim());
  if (Array.isArray(parsed.lines) && parsed.lines.length) { lines.push(...parsed.lines.map(String)); groqOk = true; }
} catch (e) { /* fallback below */ }

if (!groqOk) {
  const f = facts;
  if (f.tasks.due_today.length) lines.push(f.tasks.due_today.length + ' task(s) due today: ' + f.tasks.due_today.join('; '));
  if (f.tasks.overdue.length) lines.push('OVERDUE: ' + f.tasks.overdue.join('; '));
  if (!f.tasks.due_today.length && !f.tasks.overdue.length) lines.push('No tasks due today and nothing overdue (' + f.tasks.on_file + ' on file).');
  lines.push('Expenses this month: ' + f.expenses.this_month_total_qar + ' QAR across ' + f.expenses.this_month_count + ' receipt(s)' + (f.expenses.flagged_for_review ? ', ' + f.expenses.flagged_for_review + ' flagged for review' : '') + '.');
  if (f.sales.top_rep) lines.push('Sales: total ' + f.sales.total_revenue_qar + ' QAR on file; this month ' + f.sales.this_month_revenue_qar + ' QAR; top rep ' + f.sales.top_rep.name + ' (' + f.sales.top_rep.revenue_qar + ' QAR).');
  if (f.weather.ok) lines.push('Weather: ' + f.weather.text + ', ' + f.weather.min_c + '\\u00b0C to ' + f.weather.max_c + '\\u00b0C.');
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const w = facts.weather;
const kpi = (v, l) => '<td style="padding:10px 14px;border:1px solid #e2e8f0;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1e293b;">' + esc(v) + '</div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">' + esc(l) + '</div></td>';
const li = s => '<li style="margin:6px 0;color:#334155;">' + esc(s) + '</li>';

let html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">';
html += '<div style="background:#1e293b;padding:18px 24px;"><h1 style="margin:0;font-size:20px;color:#93c5fd;">\\u2600\\ufe0f Daily AI Briefing</h1><div style="color:#94a3b8;font-size:13px;margin-top:4px;">' + esc(facts.date) + ' \\u00b7 Doha \\u00b7 computed by n8n, narrated by Groq</div></div>';
html += '<div style="padding:18px 24px;background:#f8fafc;">';
html += '<table style="border-collapse:collapse;width:100%;font-size:12px;"><tr>';
html += kpi(facts.tasks.due_today.length, 'tasks due today');
html += kpi(facts.tasks.overdue.length, 'overdue');
html += kpi(facts.expenses.this_month_total_qar + ' QAR', 'month expenses');
html += kpi(facts.sales.this_month_revenue_qar + ' QAR', 'month revenue');
html += '</tr></table>';
if (w.ok) html += '<div style="margin-top:12px;font-size:13px;color:#475569;">Weather: <b>' + esc(w.text) + '</b> \\u00b7 ' + esc(w.temp_c) + '\\u00b0C now (min ' + esc(w.min_c) + '\\u00b0C / max ' + esc(w.max_c) + '\\u00b0C)' + (w.precip_mm ? ' \\u00b7 precip ' + esc(w.precip_mm) + ' mm' : '') + '</div>';
html += '</div>';
html += '<div style="padding:6px 24px 4px;"><h2 style="font-size:14px;color:#1e293b;margin:12px 0 6px;">\\ud83e\\udd16 AI Commentary</h2><ul style="padding-left:18px;margin:0;font-size:13px;">' + lines.map(li).join('') + '</ul></div>';
const lists = [];
if (facts.tasks.due_today.length) lists.push('<b>Due today:</b> ' + facts.tasks.due_today.map(esc).join(' \\u00b7 '));
if (facts.tasks.overdue.length) lists.push('<b style="color:#b91c1c;">Overdue:</b> ' + facts.tasks.overdue.map(esc).join(' \\u00b7 '));
if (lists.length) html += '<div style="padding:4px 24px 16px;font-size:12px;color:#475569;">' + lists.join('<br>') + '</div>';
html += '<div style="padding:10px 24px;background:#f1f5f9;font-size:10px;color:#94a3b8;">Engine: KPIs computed in deterministic code from Sheets logs (Tasks \\u00b7 Expenses \\u00b7 Sales_Orders) \\u00b7 weather Open-Meteo \\u00b7 commentary Groq gpt-oss-120b temp 0.2 grounded on facts only' + (sources.tasks !== 'ok' || sources.expenses !== 'ok' || sources.orders !== 'ok' ? ' \\u00b7 SOURCE HEALTH: ' + esc(JSON.stringify(sources)) : '') + '</div>';
html += '</div>';

const subjectStats = facts.tasks.due_today.length + ' due \\u00b7 ' + facts.expenses.this_month_total_qar + ' QAR month';

return [{ json: {
  brief_date: facts.date, facts, sources, digest_lines: lines, digest_engine: groqOk ? 'groq' : 'code-fallback',
  html, subject_stats: subjectStats
}}];`,
    };

    @node({
        id: 'db000001-0014-4b2c-9d3e-db0000000014',
        webhookId: '404acfc2-4e4e-479f-89c6-a2a922ae0192',
        name: 'Send Briefing Email',
        type: 'n8n-nodes-base.gmail',
        version: 2.2,
        position: [40, 100],
        credentials: { gmailOAuth2: { id: 'qiWG3HHdsA8yi4uD', name: 'Gmail account' } },
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 8000,
    })
    SendBriefingEmail = {
        resource: 'message',
        operation: 'send',
        sendTo: 'haxanakhtarqtr@gmail.com',
        subject: '=\\u2600\\ufe0f Daily AI Briefing {{ $json.brief_date }} \\u00b7 {{ $json.subject_stats }}',
        emailType: 'html',
        message: '={{ $json.html }}}',
    };

    @node({
        id: 'db000001-0015-4b2c-9d3e-db0000000015',
        name: 'Respond Briefing',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [280, 100],
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
    })
    RespondBriefing = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ brief_date: $('Assemble Briefing').item.json.brief_date, sources: $('Assemble Briefing').item.json.sources, digest_lines: $('Assemble Briefing').item.json.digest_lines, digest_engine: $('Assemble Briefing').item.json.digest_engine, facts: $('Assemble Briefing').item.json.facts, email_message_id: $json.id ?? null }) }}",
    };

    @node({
        id: 'db000001-0011b-4b2c-9d3e-db0000000011b',
        name: 'Merge Feeds',
        type: 'n8n-nodes-base.merge',
        version: 3.2,
        position: [-800, 100],
        notes: 'Single convergence point - n8n runs a node once per incoming connection unless a Merge node joins the branches.',
    })
    MergeFeeds = {
        numberInputs: 4,
        mode: 'append',
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.MorningCron.out(0).to(this.ReadTasks.in(0));
        this.MorningCron.out(0).to(this.ReadExpenses.in(0));
        this.MorningCron.out(0).to(this.ReadSalesOrders.in(0));
        this.MorningCron.out(0).to(this.Weather.in(0));
        this.BriefingHook.out(0).to(this.ReadTasks.in(0));
        this.BriefingHook.out(0).to(this.ReadExpenses.in(0));
        this.BriefingHook.out(0).to(this.ReadSalesOrders.in(0));
        this.BriefingHook.out(0).to(this.Weather.in(0));
        this.ReadTasks.out(0).to(this.TagTasks.in(0));
        this.ReadExpenses.out(0).to(this.TagExpenses.in(0));
        this.ReadSalesOrders.out(0).to(this.TagOrders.in(0));
        this.Weather.out(0).to(this.TagWeather.in(0));
        this.TagTasks.out(0).to(this.MergeFeeds.in(0));
        this.TagExpenses.out(0).to(this.MergeFeeds.in(1));
        this.TagOrders.out(0).to(this.MergeFeeds.in(2));
        this.TagWeather.out(0).to(this.MergeFeeds.in(3));
        this.MergeFeeds.out(0).to(this.ComputeBriefing.in(0));
        this.ComputeBriefing.out(0).to(this.DraftDigest.in(0));
        this.DraftDigest.out(0).to(this.AssembleBriefing.in(0));
        this.AssembleBriefing.out(0).to(this.SendBriefingEmail.in(0));
        this.SendBriefingEmail.out(0).to(this.RespondBriefing.in(0));
    }
}
