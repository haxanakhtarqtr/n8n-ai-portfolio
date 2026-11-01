import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Restaurant Order API
// Nodes   : 8  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// RestaurantOrderApi                 webhook
// ValidatePrice                      code
// BuildOrderRow                      code
// AppendToOrdersLog                  googleSheets               [onError→regular] [creds]
// EnsureOrdersSheet                  googleSheets               [onError→regular] [creds]
// ShouldEmail                        if
// SendInvoiceEmail                   gmail                      [onError→regular] [creds]
// RespondToOrderRequest              respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// RestaurantOrderApi
//    → ValidatePrice
//      → ShouldEmail
//        → SendInvoiceEmail
//          → RespondToOrderRequest
//       .out(1) → RespondToOrderRequest (↩ loop)
//      → BuildOrderRow
//        → AppendToOrdersLog
//      → EnsureOrdersSheet
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'WHeg2p0BsHAdZP4k',
    name: 'Restaurant Order API',
    active: false,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class RestaurantOrderApiWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'resto-order-hook',
        webhookId: 'resto-order-hook-01',
        name: 'Restaurant Order API',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [240, 300],
        notes: 'Receives confirmed orders from the AI Receptionist agent tool. Body: { items: [{item, qty}] | JSON string, customer_email }.',
    })
    RestaurantOrderApi = {
        httpMethod: 'POST',
        path: 'restaurant-order',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'resto-validate-price',
        name: 'Validate & Price',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [460, 300],
        notes: 'Deterministic rules engine: menu check, quantity check, price calc, VAT 5%, invoice HTML. The AI never prices orders — code does.',
    })
    ValidatePrice = {
        jsCode: `// ── Menu: single source of truth (code, not AI) ──
const MENU = {
  'Chicken Mandi': 28,
  'Beef Burger': 22,
  'Mixed Grill Platter': 45,
  'Fattoush Salad': 18,
  'Soft Drink': 8,
};
const VAT_RATE = 0.05;

const item_in = $input.first().json;
const body = item_in.body || item_in;

// items may arrive as an array or a JSON string from the agent tool
let items = body.items;
if (typeof items === 'string') {
  try { items = JSON.parse(items); } catch (e) { items = null; }
}
if (!Array.isArray(items)) items = [];

const customer_email = String(body.customer_email || '').trim();
const email_ok = customer_email.includes('@') && customer_email.includes('.');

// ── Rule 1: every item must be on the menu ──
const unknown = [];
const line_items = [];
for (const it of items) {
  const name = String(it.item || it.name || '').trim();
  const qty = Number(it.qty || it.quantity || 0);
  if (!name) continue;
  if (!Object.prototype.hasOwnProperty.call(MENU, name)) {
    unknown.push(name);
    continue;
  }
  if (qty <= 0) {
    unknown.push(name + ' (invalid quantity)');
    continue;
  }
  line_items.push({ item: name, qty: qty, unit_price: MENU[name], amount: Math.round(MENU[name] * qty * 100) / 100 });
}

// ── Rule 2: order must have at least one valid line ──
const empty_order = line_items.length === 0;

const subtotal = Math.round(line_items.reduce((s, li) => s + li.amount, 0) * 100) / 100;
const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
const total = Math.round((subtotal + vat) * 100) / 100;

const order_id = 'ORD-' + Date.now().toString(36).toUpperCase();
const order_status = (empty_order || unknown.length > 0) ? 'rejected' : 'confirmed';

let rejection_reason = null;
if (unknown.length > 0) {
  rejection_reason = 'Not on the menu or invalid quantity: ' + unknown.join(', ') + '. Available items: ' + Object.keys(MENU).join(', ') + '.';
} else if (empty_order) {
  rejection_reason = 'No valid items in the order. Send the menu instead.';
}

// ── Invoice HTML (light theme, matches the brand) ──
const rows = line_items.map(function (li) {
  return '<tr><td style="padding:8px 10px;border-bottom:1px solid #eaeef2">' + li.item +
    '</td><td style="padding:8px 10px;border-bottom:1px solid #eaeef2;text-align:center">' + li.qty +
    '</td><td style="padding:8px 10px;border-bottom:1px solid #eaeef2;text-align:right">' + li.unit_price.toFixed(2) +
    '</td><td style="padding:8px 10px;border-bottom:1px solid #eaeef2;text-align:right">' + li.amount.toFixed(2) + '</td></tr>';
}).join('');

const invoice_html = '<div style="font-family:Segoe UI,Arial,sans-serif;background:#f6f7f9;padding:24px">' +
  '<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d0d7de;border-radius:6px">' +
  '<div style="padding:16px 20px;border-bottom:1px solid #d0d7de">' +
  '<div style="font-size:17px;font-weight:700;color:#1f2328">Al Rayyan Grill</div>' +
  '<div style="font-size:12px;color:#57606a">Invoice ' + order_id + ' &middot; Doha, Qatar</div></div>' +
  '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
  '<tr style="background:#f6f8fa"><th style="padding:8px 10px;text-align:left">Item</th><th style="padding:8px 10px;text-align:center">Qty</th><th style="padding:8px 10px;text-align:right">Unit</th><th style="padding:8px 10px;text-align:right">Amount</th></tr>' +
  rows +
  '<tr><td style="padding:8px 10px;text-align:right" colspan="3">Subtotal</td><td style="padding:8px 10px;text-align:right;font-weight:600">' + subtotal.toFixed(2) + '</td></tr>' +
  '<tr><td style="padding:8px 10px;text-align:right" colspan="3">VAT (5%)</td><td style="padding:8px 10px;text-align:right">' + vat.toFixed(2) + '</td></tr>' +
  '<tr style="background:#f6f8fa"><td style="padding:10px;text-align:right" colspan="3"><b>Total (QAR)</b></td><td style="padding:10px;text-align:right;font-weight:700">' + total.toFixed(2) + '</td></tr>' +
  '</table>' +
  '<div style="padding:12px 20px;border-top:1px solid #d0d7de;font-size:11px;color:#6a737d">Thank you for your order. This invoice was generated automatically.</div>' +
  '</div></div>';

const menu_list = Object.keys(MENU).map(function (k) { return { item: k, price: MENU[k] }; });

// ── Email decision ──
const email_should_send = order_status === 'confirmed' && email_ok;

return [{
  json: {
    order_id: order_id,
    order_status: order_status,
    rejection_reason: rejection_reason,
    line_items: line_items,
    subtotal: subtotal,
    vat: vat,
    total: total,
    customer_email: customer_email,
    email_should_send: email_should_send,
    invoice_html: invoice_html,
    menu: menu_list,
    processed_at: new Date().toISOString(),
  },
}];`,
    };

    @node({
        id: 'resto-build-row',
        name: 'Build Order Row',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [680, 460],
        notes: 'Flattens the order into one row; autoMapInputData creates headers on the empty Orders_Log sheet.',
    })
    BuildOrderRow = {
        jsCode: `const src = $('Validate & Price').item.json;
return [{
  json: {
    'Timestamp': src.processed_at,
    'Order ID': src.order_id,
    'Customer Email': src.customer_email,
    Items: src.line_items.map(function (li) { return li.qty + 'x ' + li.item; }).join(', '),
    Subtotal: src.subtotal,
    VAT: src.vat,
    Total: src.total,
    Status: src.order_status,
    Email: src.email_should_send ? 'sent' : 'skipped',
  },
}];`,
    };

    @node({
        id: 'resto-append-log',
        name: 'Append to Orders Log',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [900, 460],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'One row per order. autoMapInputData creates the header row on the empty sheet.',
    })
    AppendToOrdersLog = {
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
            value: 'Orders_Log',
        },
        columns: {
            mappingMode: 'autoMapInputData',
        },
        options: {},
    };

    @node({
        id: 'resto-ensure-sheet',
        name: 'Ensure Orders Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [680, 560],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'First-run tab creation. Dead-end side branch — never sits between data and output.',
    })
    EnsureOrdersSheet = {
        resource: 'sheet',
        operation: 'create',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        title: 'Orders_Log',
        options: {},
    };

    @node({
        id: 'resto-should-email',
        name: 'Should Email?',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [1120, 300],
        notes: 'True = confirmed order with a valid email address → send the invoice email.',
    })
    ShouldEmail = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'cond-email-send',
                    leftValue: '={{ $json.email_should_send }}',
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'resto-send-invoice',
        webhookId: '72ffe77e-86f0-4c25-9639-1b37f50ae4c7',
        name: 'Send Invoice Email',
        type: 'n8n-nodes-base.gmail',
        version: 2.2,
        position: [1340, 180],
        credentials: { gmailOAuth2: { id: 'qiWG3HHdsA8yi4uD', name: 'Gmail account' } },
        onError: 'continueRegularOutput',
        notes: 'Sends the HTML invoice to the customer. Email failures never block the API response.',
    })
    SendInvoiceEmail = {
        resource: 'message',
        operation: 'send',
        sendTo: "={{ $('Validate & Price').item.json.customer_email }}",
        subject: "=Your order {{ $('Validate & Price').item.json.order_id }} — Al Rayyan Grill",
        emailType: 'html',
        message: "={{ $('Validate & Price').item.json.invoice_html }}",
        options: {},
    };

    @node({
        id: 'resto-respond',
        name: 'Respond to Order Request',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.5,
        position: [1560, 300],
        notes: 'Contract: { order_id, order_status, email_status, total, line_items, rejection_reason, menu }.',
    })
    RespondToOrderRequest = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ order_id: $('Validate & Price').item.json.order_id, order_status: $('Validate & Price').item.json.order_status, email_status: $('Validate & Price').item.json.email_should_send ? ($('Send Invoice Email').isExecuted ? 'sent' : 'queued') : 'skipped', total: $('Validate & Price').item.json.total, line_items: $('Validate & Price').item.json.line_items, rejection_reason: $('Validate & Price').item.json.rejection_reason, menu: $('Validate & Price').item.json.menu }) }}",
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.RestaurantOrderApi.out(0).to(this.ValidatePrice.in(0));
        this.ValidatePrice.out(0).to(this.ShouldEmail.in(0));
        this.ValidatePrice.out(0).to(this.BuildOrderRow.in(0));
        this.ValidatePrice.out(0).to(this.EnsureOrdersSheet.in(0));
        this.ShouldEmail.out(0).to(this.SendInvoiceEmail.in(0));
        this.ShouldEmail.out(1).to(this.RespondToOrderRequest.in(0));
        this.SendInvoiceEmail.out(0).to(this.RespondToOrderRequest.in(0));
        this.BuildOrderRow.out(0).to(this.AppendToOrdersLog.in(0));
    }
}
