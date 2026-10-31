import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Live Ops Dashboard API
// Nodes   : 6  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// DashboardHook                      webhook
// ReadInvoiceLog                     googleSheets               [onError→regular] [creds]
// ReadTriageLog                      googleSheets               [onError→regular] [creds]
// ReadClaimsLog                      googleSheets               [onError→regular] [creds]
// AggregateStats                     code
// ReturnDashboardJson                respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// DashboardHook
//    → ReadInvoiceLog
//      → ReadTriageLog
//        → ReadClaimsLog
//          → AggregateStats
//            → ReturnDashboardJson
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'g6su9aeH8golKanB',
    name: 'Live Ops Dashboard API',
    active: true,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class LiveOpsDashboardApiWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'dashboard-hook',
        webhookId: 'dashboard-hook-01',
        name: 'Dashboard Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [240, 300],
        notes: 'GET endpoint polled by the dashboard page. Returns live KPIs computed from the Invoice_Log, Triage_Log and Claims_Log sheets.',
    })
    DashboardHook = {
        httpMethod: 'GET',
        path: 'dashboard-stats',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'dashboard-read-invoices',
        name: 'Read Invoice Log',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [460, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Reads all rows from Invoice_Log. Credential or tab errors degrade gracefully to an empty dataset.',
    })
    ReadInvoiceLog = {
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
            value: 'Invoice_Log',
        },
        options: {},
    };

    @node({
        id: 'dashboard-read-triage',
        name: 'Read Triage Log',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [680, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Reads all rows from Triage_Log.',
    })
    ReadTriageLog = {
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
            value: 'Triage_Log',
        },
        options: {},
    };

    @node({
        id: 'dashboard-read-claims',
        name: 'Read Claims Log',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [900, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Reads all rows from Claims_Log.',
    })
    ReadClaimsLog = {
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
            value: 'Claims_Log',
        },
        options: {},
    };

    @node({
        id: 'dashboard-aggregate',
        name: 'Aggregate Stats',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1120, 300],
        notes: 'Computes live KPIs: processing volumes, validity / escalation / auto-settle rates, handled value and recent activity. Rows are filtered by expected columns so error-passthrough items never inflate counts.',
    })
    AggregateStats = {
        jsCode: `// Read a sheet node defensively: error-passthrough items (onError continue) expose { error: ... }
const readSheet = (nodeName, keyColumn) => {
  let items = [];
  try { items = $(nodeName).all().map(i => i.json); } catch (e) { items = []; }
  const hasError = items.length === 1 && items[0] && items[0].error;
  const rows = items.filter(r => r[keyColumn] !== undefined && r[keyColumn] !== '');
  return { rows: rows, status: hasError ? 'error' : (rows.length > 0 ? 'ok' : 'empty') };
};

const invoice = readSheet('Read Invoice Log', 'Invoice Number');
const triage = readSheet('Read Triage Log', 'Sender');
const claim = readSheet('Read Claims Log', 'Policy #');
const invoiceRows = invoice.rows;
const triageRows = triage.rows;
const claimRows = claim.rows;

const pct = (num, den) => den > 0 ? Math.round((num / den) * 100) : 0;
const sum = (arr, pick) => arr.reduce((acc, r) => acc + (Number(pick(r)) || 0), 0);

// ── Invoice IDP KPIs ──
const invoiceValid = invoiceRows.filter(r => String(r['Status']) === 'Valid').length;
const invoiceValue = sum(invoiceRows, r => r['Total']);

// ── Triage KPIs ──
const triageCategories = {};
for (const r of triageRows) {
  const c = String(r['Category'] || 'OTHER');
  triageCategories[c] = (triageCategories[c] || 0) + 1;
}
const triageEscalated = triageRows.filter(r => String(r['Escalated']) === 'YES').length;

// ── Claims KPIs ──
const claimDecisions = {};
for (const r of claimRows) {
  const d = String(r['Decision'] || 'unknown');
  claimDecisions[d] = (claimDecisions[d] || 0) + 1;
}
const claimAutoSettled = claimDecisions['auto_settle'] || 0;
const claimValue = sum(claimRows, r => r['Claimed Amount']);

// ── Recent activity (last 3 of each, newest rows assumed last) ──
const recent = {
  invoices: invoiceRows.slice(-3).reverse().map(r => ({
    vendor: r['Vendor'], invoice_number: r['Invoice Number'], total: r['Total'],
    currency: r['Currency'], status: r['Status'], flags: r['Flags'], timestamp: r['Timestamp'],
  })),
  triage: triageRows.slice(-3).reverse().map(r => ({
    sender: r['Sender'], subject: r['Subject'], category: r['Category'],
    urgency: r['Urgency'], sentiment: r['Sentiment'], escalated: r['Escalated'], timestamp: r['Timestamp'],
  })),
  claims: claimRows.slice(-3).reverse().map(r => ({
    policy: r['Policy #'], claimant: r['Claimant'], claim_type: r['Claim Type'],
    amount: r['Claimed Amount'], decision: r['Decision'], fraud_score: r['Fraud Score'], timestamp: r['Timestamp'],
  })),
};

return [{
  json: {
    updated_at: new Date().toISOString(),
    health: {
      invoice_log: invoice.status,
      triage_log: triage.status,
      claims_log: claim.status,
    },
    invoices: {
      total: invoiceRows.length,
      valid: invoiceValid,
      needs_review: invoiceRows.length - invoiceValid,
      valid_rate_pct: pct(invoiceValid, invoiceRows.length),
      total_value: invoiceValue,
    },
    triage: {
      total: triageRows.length,
      escalated: triageEscalated,
      escalation_rate_pct: pct(triageEscalated, triageRows.length),
      categories: triageCategories,
    },
    claims: {
      total: claimRows.length,
      auto_settled: claimAutoSettled,
      auto_settle_rate_pct: pct(claimAutoSettled, claimRows.length),
      decisions: claimDecisions,
      claimed_value: claimValue,
    },
    recent: recent,
  },
}];`,
    };

    @node({
        id: 'dashboard-return',
        name: 'Return Dashboard JSON',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.5,
        position: [1340, 300],
        notes: 'Returns the live KPI payload consumed by the dashboard page.',
    })
    ReturnDashboardJson = {
        respondWith: 'json',
        responseBody: "={{ JSON.stringify($('Aggregate Stats').item.json) }}",
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.DashboardHook.out(0).to(this.ReadInvoiceLog.in(0));
        this.ReadInvoiceLog.out(0).to(this.ReadTriageLog.in(0));
        this.ReadTriageLog.out(0).to(this.ReadClaimsLog.in(0));
        this.ReadClaimsLog.out(0).to(this.AggregateStats.in(0));
        this.AggregateStats.out(0).to(this.ReturnDashboardJson.in(0));
    }
}
