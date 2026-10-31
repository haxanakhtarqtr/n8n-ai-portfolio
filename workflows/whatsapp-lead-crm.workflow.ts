import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : WhatsApp Lead CRM
// Nodes   : 11  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WhatsappHook                       webhook
// ParseWhatsappMessage               code
// LeadIntelAgent                     agent                      [AI]
// MistralModel                       lmChatMistralCloud         [creds] [ai_languageModel]
// CrmLogic                           code
// EnsureCrmSheet                     googleSheets               [onError→regular] [creds]
// EnsureOutboxSheet                  googleSheets               [onError→regular] [creds]
// CrmUpsert                          googleSheets               [onError→regular] [creds]
// AutoReplyNeeded                    if
// QueueOutboundReply                 googleSheets               [onError→regular] [creds]
// ReturnLeadResult                   respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WhatsappHook
//    → ParseWhatsappMessage
//      → LeadIntelAgent
//        → CrmLogic
//          → AutoReplyNeeded
//            → QueueOutboundReply
//              → ReturnLeadResult
//           .out(1) → ReturnLeadResult (↩ loop)
//          → EnsureCrmSheet
//            → EnsureOutboxSheet
//          → CrmUpsert
//
// AI CONNECTIONS
// LeadIntelAgent.uses({ ai_languageModel: MistralModel })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'YAzWvxajd6ob7DxE',
    name: 'WhatsApp Lead CRM',
    active: true,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class WhatsappLeadCrmWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'wa-crm-hook',
        webhookId: 'wa-crm-hook-01',
        name: 'WhatsApp Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [240, 300],
        notes: 'Intake for WhatsApp messages. Parses the native Meta webhook payload shape; also accepts a simple { from, name, message } body for demos.',
    })
    WhatsappHook = {
        httpMethod: 'POST',
        path: 'whatsapp-crm',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'wa-parse-message',
        name: 'Parse WhatsApp Message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [460, 300],
        notes: 'Normalizes Meta WhatsApp webhook payloads and simple demo bodies into one message shape.',
    })
    ParseWhatsappMessage = {
        jsCode: `const item = $input.first().json;
const body = item.body || item;

// Safe nested getter
const get = (obj, path) => {
  let cur = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[key];
  }
  return cur;
};

let from = null;
let name = null;
let text = null;
let waId = null;

// Shape 1: native Meta webhook payload
const metaMessage = get(body, ['entry', 0, 'changes', 0, 'value', 'messages', 0]);
const metaContact = get(body, ['entry', 0, 'changes', 0, 'value', 'contacts', 0]);
if (metaMessage) {
  from = metaMessage.from || null;
  waId = (metaContact && metaContact.wa_id) || from;
  name = (metaContact && metaContact.profile && metaContact.profile.name) || null;
  text = (metaMessage.text && metaMessage.text.body) || (metaMessage.button && metaMessage.button.text) || '';
}

// Shape 2: simple demo body
if (!from && (body.from || body.phone)) {
  from = body.from || body.phone;
  waId = from;
  name = body.name || null;
  text = body.message || body.text || '';
}

if (!from || !text) {
  throw new Error('No WhatsApp message found. Send the Meta webhook payload or { "from": "974xxxxxxx", "name": "...", "message": "..." }');
}

return [{
  json: {
    phone: String(from),
    wa_id: String(waId || from),
    contact_name: name || 'Unknown contact',
    message: text,
    received_at: new Date().toISOString(),
  },
}];`,
    };

    @node({
        id: 'wa-lead-intel-agent',
        name: 'Lead Intel Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [680, 300],
        notes: 'Extracts lead intelligence from the WhatsApp message: identity, intent, budget/timeline signals, stage and a WhatsApp-style auto-reply.',
    })
    LeadIntelAgent = {
        promptType: 'define',
        text: "={{ 'CONTACT: ' + $json.contact_name + ' (wa.me/' + $json.phone + ')\\n\\nWHATSAPP MESSAGE:\\n' + $json.message }}",
        options: {
            systemMessage: `You are a WhatsApp Lead Intelligence agent for a B2B office supplies and services company in Doha, Qatar.

TASK: Analyze one inbound WhatsApp message and return lead intelligence.

STAGE RULES:
- QUALIFIED: clear buying intent (asks price, quotation, wants to buy, states quantity/budget/timeline)
- NURTURE: interested but vague (asks general info, "maybe later", no specifics)
- NEW: simple greeting or first contact with no substance
- SPAM: promotional messages, crypto, job offers, unrelated marketing

LEAD SCORE: 1-10 (10 = ready to buy now). Score generously for stated budget + quantity + timeline.

WHATSAPP REPLY RULES:
- SPAM: whatsapp_reply must be null.
- Otherwise: max 40 words, WhatsApp tone (friendly, 1-2 emojis max, no formal letter style).
- Price inquiries: welcome warmly, promise quotation today, ask one short qualifying question (quantity or delivery area).
- Follow-ups: acknowledge and move things forward.

OUTPUT RULES (STRICT):
1. Respond with ONE JSON object and NOTHING else. No markdown fences.
2. Use null for unknown. Never invent facts (no fake company names).

JSON SCHEMA:
{
  "contact_name": string | null,
  "company_guess": string | null,
  "intent": "price_inquiry" | "product_inquiry" | "support" | "greeting" | "spam" | "other",
  "interest_summary": string (max 12 words),
  "budget_signal": string | null,
  "timeline_signal": string | null,
  "quantity_signal": string | null,
  "lead_score": number,
  "stage": "QUALIFIED" | "NURTURE" | "NEW" | "SPAM",
  "whatsapp_reply": string | null
}`,
        },
    };

    @node({
        id: 'wa-mistral-model',
        name: 'Mistral Model',
        type: '@n8n/n8n-nodes-langchain.lmChatMistralCloud',
        version: 1,
        position: [620, 520],
        credentials: { mistralCloudApi: { id: 'fCLkBkCGQaMocIDv', name: 'Mistral Cloud account' } },
    })
    MistralModel = {
        model: 'ministral-3b-latest',
        options: {
            temperature: 0.3,
        },
    };

    @node({
        id: 'wa-crm-logic',
        name: 'CRM Logic',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [900, 300],
        notes: 'Deterministic CRM layer: dedupe key (phone), stage normalization, score clamping, reply routing decision.',
    })
    CrmLogic = {
        jsCode: `const agentOut = $input.first().json.output || '';

// Extract JSON without regex
const start = agentOut.indexOf('{');
const end = agentOut.lastIndexOf('}');
if (start === -1 || end === -1) {
  throw new Error('Agent did not return JSON. Raw output: ' + agentOut.substring(0, 200));
}
let intel;
try {
  intel = JSON.parse(agentOut.substring(start, end + 1));
} catch (err) {
  throw new Error('Agent JSON could not be parsed: ' + err.message);
}

const input = $('Parse WhatsApp Message').item.json;

// Normalize enums
const validStages = ['QUALIFIED', 'NURTURE', 'NEW', 'SPAM'];
const validIntents = ['price_inquiry', 'product_inquiry', 'support', 'greeting', 'spam', 'other'];
if (!validStages.includes(intel.stage)) intel.stage = 'NEW';
if (!validIntents.includes(intel.intent)) intel.intent = 'other';

// Clamp score
let score = Number(intel.lead_score);
if (isNaN(score)) score = 3;
if (score < 1) score = 1;
if (score > 10) score = 10;

// Spam overrides everything
const isSpam = intel.stage === 'SPAM';
const replyNeeded = !isSpam && !!intel.whatsapp_reply;

// CRM dedupe key: wa.me phone number
const leadId = 'wa.me/' + input.phone.replace(/[^0-9]/g, '');

return [{
  json: {
    lead: {
      lead_id: leadId,
      phone: input.phone,
      contact_name: intel.contact_name || input.contact_name,
      company_guess: intel.company_guess,
      intent: intel.intent,
      interest_summary: intel.interest_summary,
      budget_signal: intel.budget_signal,
      timeline_signal: intel.timeline_signal,
      quantity_signal: intel.quantity_signal,
    },
    stage: intel.stage,
    lead_score: score,
    whatsapp_reply: isSpam ? null : intel.whatsapp_reply,
    reply_needed: replyNeeded,
    last_message: input.message,
    processed_at: new Date().toISOString(),
  },
}];`,
    };

    @node({
        id: 'wa-ensure-crm-sheet',
        name: 'Ensure CRM Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1120, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Creates the CRM_Pipeline tab on first run.',
    })
    EnsureCrmSheet = {
        resource: 'sheet',
        operation: 'create',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        title: 'CRM_Pipeline',
        options: {},
    };

    @node({
        id: 'wa-ensure-outbox-sheet',
        name: 'Ensure Outbox Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1260, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Creates the Outbound_Queue tab on first run.',
    })
    EnsureOutboxSheet = {
        resource: 'sheet',
        operation: 'create',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        title: 'Outbound_Queue',
        options: {},
    };

    @node({
        id: 'wa-crm-upsert',
        name: 'CRM Upsert',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1400, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'appendOrUpdate matched on Phone: repeat contacts update their existing row instead of duplicating — real CRM behavior.',
    })
    CrmUpsert = {
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'CRM_Pipeline',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                Phone: "={{ $('CRM Logic').item.json.lead.phone }}",
                'Lead ID': "={{ $('CRM Logic').item.json.lead.lead_id }}",
                Name: "={{ $('CRM Logic').item.json.lead.contact_name }}",
                Company: "={{ $('CRM Logic').item.json.lead.company_guess || '' }}",
                Stage: "={{ $('CRM Logic').item.json.stage }}",
                'Lead Score': "={{ $('CRM Logic').item.json.lead_score }}",
                Intent: "={{ $('CRM Logic').item.json.lead.intent }}",
                Interest: "={{ $('CRM Logic').item.json.lead.interest_summary }}",
                Budget: "={{ $('CRM Logic').item.json.lead.budget_signal || '' }}",
                Timeline: "={{ $('CRM Logic').item.json.lead.timeline_signal || '' }}",
                'Last Message': "={{ $('CRM Logic').item.json.last_message }}",
                'Last Contact': "={{ $('CRM Logic').item.json.processed_at }}",
            },
            matchingColumns: ['Phone'],
            schema: [],
            attemptToConvertTypes: false,
            convertFieldsToString: false,
        },
        options: {},
    };

    @node({
        id: 'wa-reply-needed',
        name: 'Auto Reply Needed?',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [1620, 300],
        notes: 'True when the lead is not spam and a reply was drafted. Queue the reply for outbound sending.',
    })
    AutoReplyNeeded = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'cond-reply-needed',
                    leftValue: "={{ $('CRM Logic').item.json.reply_needed }}",
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'true',
            },
            schema: [
                { id: 'Phone', displayName: 'Phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Lead ID', displayName: 'Lead ID', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Name', displayName: 'Name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Company', displayName: 'Company', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Stage', displayName: 'Stage', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Lead Score', displayName: 'Lead Score', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Intent', displayName: 'Intent', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Interest', displayName: 'Interest', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Budget', displayName: 'Budget', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Timeline', displayName: 'Timeline', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Last Message', displayName: 'Last Message', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Last Contact', displayName: 'Last Contact', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'matchingColumns', displayName: 'matchingColumns', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'schema', displayName: 'schema', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'attemptToConvertTypes', displayName: 'attemptToConvertTypes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'convertFieldsToString', displayName: 'convertFieldsToString', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'options', displayName: 'options', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'id', displayName: 'id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'type', displayName: 'type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'version', displayName: 'version', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'position', displayName: 'position', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'notes', displayName: 'notes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'conditions', displayName: 'conditions', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'caseSensitive', displayName: 'caseSensitive', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'leftValue', displayName: 'leftValue', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'typeValidation', displayName: 'typeValidation', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'rightValue', displayName: 'rightValue', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'operator', displayName: 'operator', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'operation', displayName: 'operation', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
            ],
        },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'wa-queue-reply',
        name: 'Queue Outbound Reply',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1840, 180],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Outbox pattern: replies are queued in Outbound_Queue. Swap this node for the official WhatsApp Send node once a whatsappApi credential exists.',
    })
    QueueOutboundReply = {
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
            value: 'Outbound_Queue',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                'Queued At': "={{ $('CRM Logic').item.json.processed_at }}",
                Phone: "={{ $('CRM Logic').item.json.lead.phone }}",
                Name: "={{ $('CRM Logic').item.json.lead.contact_name }}",
                Stage: "={{ $('CRM Logic').item.json.stage }}",
                Reply: "={{ $('CRM Logic').item.json.whatsapp_reply }}",
            },
            schema: [
                { id: 'Queued At', displayName: 'Queued At', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Phone', displayName: 'Phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Name', displayName: 'Name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Stage', displayName: 'Stage', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
                { id: 'Reply', displayName: 'Reply', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedInMatch: true, readOnly: false, removed: false },
            ],
        },
        options: {},
    };

    @node({
        id: 'wa-return-result',
        name: 'Return Lead Result',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.5,
        position: [2060, 300],
        notes: 'Returns the lead intelligence, CRM stage, auto-reply and queue status as JSON.',
    })
    ReturnLeadResult = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ stage: $('CRM Logic').item.json.stage, lead_score: $('CRM Logic').item.json.lead_score, lead: $('CRM Logic').item.json.lead, whatsapp_reply: $('CRM Logic').item.json.whatsapp_reply, reply_queued: $('CRM Logic').item.json.reply_needed, crm_action: 'upsert-by-phone', processed_at: $('CRM Logic').item.json.processed_at }) }}",
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WhatsappHook.out(0).to(this.ParseWhatsappMessage.in(0));
        this.ParseWhatsappMessage.out(0).to(this.LeadIntelAgent.in(0));
        this.LeadIntelAgent.out(0).to(this.CrmLogic.in(0));
        this.CrmLogic.out(0).to(this.AutoReplyNeeded.in(0));
        this.CrmLogic.out(0).to(this.EnsureCrmSheet.in(0));
        this.CrmLogic.out(0).to(this.CrmUpsert.in(0));
        this.AutoReplyNeeded.out(0).to(this.QueueOutboundReply.in(0));
        this.AutoReplyNeeded.out(1).to(this.ReturnLeadResult.in(0));
        this.QueueOutboundReply.out(0).to(this.ReturnLeadResult.in(0));
        this.EnsureCrmSheet.out(0).to(this.EnsureOutboxSheet.in(0));

        this.LeadIntelAgent.uses({
            ai_languageModel: this.MistralModel.output,
        });
    }
}
