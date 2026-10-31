import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Email Triage & Sentiment Agent
// Nodes   : 11  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// MessageHook                        webhook
// PrepareTriageTask                  code
// TriageAgent                        agent                      [AI]
// MistralModel                       lmChatMistralCloud         [creds] [ai_languageModel]
// ParseEnrich                        code
// EnsureLogSheet                     googleSheets               [onError→regular] [creds]
// BuildTriageRow                     code
// AppendToTriageLog                  googleSheets               [onError→regular] [creds]
// NeedsImmediateAlert                if
// PriorityAlert                      httpRequest
// ReturnTriageResult                 respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// MessageHook
//    → PrepareTriageTask
//      → TriageAgent
//        → ParseEnrich
//          → NeedsImmediateAlert
//            → PriorityAlert
//              → ReturnTriageResult
//           .out(1) → ReturnTriageResult (↩ loop)
//          → EnsureLogSheet
//          → BuildTriageRow
//            → AppendToTriageLog
//
// AI CONNECTIONS
// TriageAgent.uses({ ai_languageModel: MistralModel })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'Imq3EubMvYwf6yB9',
    name: 'Email Triage & Sentiment Agent',
    active: true,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class EmailTriageSentimentAgentWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'triage-message-hook',
        webhookId: 'triage-message-hook-01',
        name: 'Message Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [240, 300],
        notes: 'Universal intake for inbound messages (email, chat, WhatsApp, contact form). Accepts sender, subject, message, channel.',
    })
    MessageHook = {
        httpMethod: 'POST',
        path: 'triage-message',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'triage-prepare-task',
        name: 'Prepare Triage Task',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [460, 300],
        notes: 'Normalizes the inbound message into a triage prompt.',
    })
    PrepareTriageTask = {
        jsCode: `const item = $input.first().json;
const body = item.body || item;

const message = body.message || body.body || body.text || body.content || '';
if (!message) {
  throw new Error('No message text found. Send JSON body: { "sender": "...", "subject": "...", "message": "..." }');
}

return [{
  json: {
    sender: body.sender || body.from || 'unknown',
    subject: body.subject || '(no subject)',
    channel: body.channel || 'email',
    message: message,
    receivedAt: new Date().toISOString(),
  },
}];`,
    };

    @node({
        id: 'triage-agent',
        name: 'Triage Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [680, 300],
        notes: 'Classifies category, urgency, sentiment, priority; extracts entities; drafts a reply. Strict JSON output.',
    })
    TriageAgent = {
        promptType: 'define',
        text: "={{ 'SENDER: ' + $json.sender + '\\nSUBJECT: ' + $json.subject + '\\nCHANNEL: ' + $json.channel + '\\n\\nMESSAGE:\\n' + $json.message }}",
        options: {
            systemMessage: `You are an Email & Message Triage Agent for a busy B2B sales and support operation in Qatar.

TASK: Analyze the inbound message and return a triage assessment.

CLASSIFICATION RULES:
- Category: URGENT (complaints, threats, deadlines today, legal mentions, payment disputes) | SALES_INQUIRY (quotations, pricing, product interest) | SUPPORT_REQUEST (how-to, technical help, account issues) | NORMAL (general correspondence) | SPAM (lottery, crypto, link bait, unsolicited bulk marketing)
- Urgency: critical (act within minutes) | high (today) | medium (this week) | low (whenever)
- Sentiment: very_positive | positive | neutral | negative | angry
  Anger cues: ALL CAPS words, threats to cancel, legal action mentions, repeated complaints, exclamation clusters.
- sentiment_score: -1.0 (furious) to 1.0 (delighted), 0 = neutral.
- priority_score: 1-10 (10 = drop everything).
- key_entities: important dates, amounts, order/contract numbers, phone numbers, deadlines.

DRAFT REPLY RULES:
- For SPAM: draft_reply must be null.
- For everything else: write a short (max 60 words), professional, ready-to-send draft reply. Match the tone: calm and solution-focused for angry senders; warm and keen for sales inquiries.

OUTPUT RULES (STRICT):
1. Respond with ONE JSON object and NOTHING else. No markdown fences, no explanations.
2. Use null for unknown fields. Never invent facts.

JSON SCHEMA:
{
  "category": "URGENT" | "SALES_INQUIRY" | "SUPPORT_REQUEST" | "NORMAL" | "SPAM",
  "urgency": "critical" | "high" | "medium" | "low",
  "sentiment": "very_positive" | "positive" | "neutral" | "negative" | "angry",
  "sentiment_score": number,
  "priority_score": number,
  "language": string,
  "summary": string (max 20 words),
  "key_entities": [ { "type": "date" | "amount" | "order_number" | "person" | "phone" | "deadline", "value": string } ],
  "suggested_action": string (max 15 words),
  "draft_reply": string | null,
  "spam_reason": string | null
}`,
        },
    };

    @node({
        id: 'triage-mistral-model',
        name: 'Mistral Model',
        type: '@n8n/n8n-nodes-langchain.lmChatMistralCloud',
        version: 1,
        position: [620, 520],
        credentials: { mistralCloudApi: { id: 'fCLkBkCGQaMocIDv', name: 'Mistral Cloud account' } },
    })
    MistralModel = {
        model: 'ministral-3b-latest',
        options: {
            temperature: 0.2,
        },
    };

    @node({
        id: 'triage-parse-enrich',
        name: 'Parse & Enrich',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [900, 300],
        notes: 'Parses agent JSON, adds SLA target, escalation decision and normalized routing fields.',
    })
    ParseEnrich = {
        jsCode: `const agentOut = $input.first().json.output || '';

// Extract JSON without regex: first { to last }
const start = agentOut.indexOf('{');
const end = agentOut.lastIndexOf('}');
if (start === -1 || end === -1) {
  throw new Error('Agent did not return JSON. Raw output: ' + agentOut.substring(0, 200));
}
let triage;
try {
  triage = JSON.parse(agentOut.substring(start, end + 1));
} catch (err) {
  throw new Error('Agent JSON could not be parsed: ' + err.message);
}

// Normalize enums (agent may drift)
const validCategories = ['URGENT', 'SALES_INQUIRY', 'SUPPORT_REQUEST', 'NORMAL', 'SPAM'];
const validUrgency = ['critical', 'high', 'medium', 'low'];
const validSentiment = ['very_positive', 'positive', 'neutral', 'negative', 'angry'];
if (!validCategories.includes(triage.category)) triage.category = 'NORMAL';
if (!validUrgency.includes(triage.urgency)) triage.urgency = 'medium';
if (!validSentiment.includes(triage.sentiment)) triage.sentiment = 'neutral';

// SLA targets per urgency
const slaMap = { critical: '15 minutes', high: '1 hour', medium: '4 hours', low: '24 hours' };
const sla = slaMap[triage.urgency] || '4 hours';

// Escalation: urgent category OR angry sender with high priority
const escalate = triage.category === 'URGENT' || (triage.sentiment === 'angry' && Number(triage.priority_score) >= 7);

// Clamp scores
let sentimentScore = Number(triage.sentiment_score);
if (isNaN(sentimentScore)) sentimentScore = 0;
if (sentimentScore < -1) sentimentScore = -1;
if (sentimentScore > 1) sentimentScore = 1;
let priorityScore = Number(triage.priority_score);
if (isNaN(priorityScore)) priorityScore = 5;
if (priorityScore < 1) priorityScore = 1;
if (priorityScore > 10) priorityScore = 10;

const input = $('Prepare Triage Task').item.json;

return [{
  json: {
    sender: input.sender,
    subject: input.subject,
    channel: input.channel,
    received_at: input.receivedAt,
    triage: triage,
    priority_score: priorityScore,
    sentiment_score: sentimentScore,
    sla_target: sla,
    escalate: escalate,
    processed_at: new Date().toISOString(),
  },
}];`,
    };

    @node({
        id: 'triage-ensure-sheet',
        name: 'Ensure Log Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1120, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Creates the Triage_Log tab on first run. Errors (tab exists, credential gap) do not block the triage result.',
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
        title: 'Triage_Log',
        options: {},
    };

    @node({
        id: 'triage-build-row',
        name: 'Build Triage Row',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1030, 460],
        notes: 'Flattens the triage result into one row; autoMapInputData creates headers on the empty sheet.',
    })
    BuildTriageRow = {
        jsCode: `const src = $('Parse & Enrich').item.json;
return [{
  json: {
    'Timestamp': src.processed_at,
    'Channel': src.channel,
    'Sender': src.sender,
    'Subject': src.subject,
    'Category': src.triage.category,
    'Urgency': src.triage.urgency,
    'Sentiment': src.triage.sentiment,
    'Sentiment Score': src.sentiment_score,
    'Priority Score': src.priority_score,
    'SLA Target': src.sla_target,
    'Escalated': src.escalate ? 'YES' : 'no',
    'Suggested Action': src.triage.suggested_action,
  },
}];`,
    };

    @node({
        id: 'triage-append-log',
        name: 'Append to Triage Log',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1340, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'One row per triaged message. Sheet errors never block the response (onError continue).',
    })
    AppendToTriageLog = {
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
            value: 'Triage_Log',
        },
        columns: {
            mappingMode: 'autoMapInputData',
        },
        options: {},
    };

    @node({
        id: 'triage-needs-alert',
        name: 'Needs Immediate Alert?',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [1560, 300],
        notes: 'True when category is URGENT or sender is angry. Fires the Mattermost priority alert.',
    })
    NeedsImmediateAlert = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'cond-urgent-category',
                    leftValue: "={{ $('Parse & Enrich').item.json.triage.category }}",
                    rightValue: 'URGENT',
                    operator: {
                        type: 'string',
                        operation: 'equals',
                    },
                },
                {
                    id: 'cond-angry-sentiment',
                    leftValue: "={{ $('Parse & Enrich').item.json.triage.sentiment }}",
                    rightValue: 'angry',
                    operator: {
                        type: 'string',
                        operation: 'equals',
                    },
                },
            ],
            combinator: 'or',
        },
        options: {},
    };

    @node({
        id: 'triage-priority-alert',
        name: 'Priority Alert',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.5,
        position: [1780, 180],
        notes: 'Posts urgent/angry messages to the Mattermost channel with SLA target and ready-to-send draft reply.',
    })
    PriorityAlert = {
        method: 'POST',
        url: 'http://host.docker.internal:8065/hooks/zceo56iq8b8mdpkzfj3ehan6ny',
        authentication: 'none',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ text: '🔴 *PRIORITY MESSAGE — IMMEDIATE ATTENTION*\\n\\n*From:* ' + $('Parse & Enrich').item.json.sender + '\\n*Subject:* ' + $('Parse & Enrich').item.json.subject + '\\n*Channel:* ' + $('Parse & Enrich').item.json.channel + '\\n*Category:* ' + $('Parse & Enrich').item.json.triage.category + ' (priority ' + $('Parse & Enrich').item.json.priority_score + '/10)\\n*Sentiment:* ' + $('Parse & Enrich').item.json.triage.sentiment + ' (score ' + $('Parse & Enrich').item.json.sentiment_score + ')\\n*SLA Target:* ' + $('Parse & Enrich').item.json.sla_target + '\\n\\n*Suggested action:* ' + ($('Parse & Enrich').item.json.triage.suggested_action || '-') + '\\n\\n*Draft reply:*\\n> ' + ($('Parse & Enrich').item.json.triage.draft_reply || 'no draft') }) }}",
        options: {},
    };

    @node({
        id: 'triage-return-result',
        name: 'Return Triage Result',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.5,
        position: [2000, 300],
        notes: 'Returns the full triage assessment as JSON to the caller. Single response node for both branches.',
    })
    ReturnTriageResult = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ status: $('Parse & Enrich').item.json.escalate ? 'escalated' : 'routed', triage: $('Parse & Enrich').item.json.triage, priority_score: $('Parse & Enrich').item.json.priority_score, sentiment_score: $('Parse & Enrich').item.json.sentiment_score, sla_target: $('Parse & Enrich').item.json.sla_target, escalate: $('Parse & Enrich').item.json.escalate, logged_to_sheets: true }) }}",
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.MessageHook.out(0).to(this.PrepareTriageTask.in(0));
        this.PrepareTriageTask.out(0).to(this.TriageAgent.in(0));
        this.TriageAgent.out(0).to(this.ParseEnrich.in(0));
        this.ParseEnrich.out(0).to(this.NeedsImmediateAlert.in(0));
        this.ParseEnrich.out(0).to(this.EnsureLogSheet.in(0));
        this.ParseEnrich.out(0).to(this.BuildTriageRow.in(0));
        this.BuildTriageRow.out(0).to(this.AppendToTriageLog.in(0));
        this.NeedsImmediateAlert.out(0).to(this.PriorityAlert.in(0));
        this.NeedsImmediateAlert.out(1).to(this.ReturnTriageResult.in(0));
        this.PriorityAlert.out(0).to(this.ReturnTriageResult.in(0));

        this.TriageAgent.uses({
            ai_languageModel: this.MistralModel.output,
        });
    }
}
