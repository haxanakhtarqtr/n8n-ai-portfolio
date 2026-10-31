import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Insurance Claim Intake Bot
// Nodes   : 11  |  Connections: 10
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ClaimHook                          webhook
// PrepareClaimTask                   code
// ClaimAssessmentAgent               agent                      [AI]
// MistralModel                       lmChatMistralCloud         [creds] [ai_languageModel]
// ParseApplyRules                    code
// EnsureLogSheet                     googleSheets               [onError→regular] [creds]
// BuildClaimRow                      code
// AppendToClaimsLog                  googleSheets               [onError→regular] [creds]
// NeedsUnderwriter                   if
// UnderwriterAlert                   httpRequest
// ReturnClaimDecision                respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ClaimHook
//    → PrepareClaimTask
//      → ClaimAssessmentAgent
//        → ParseApplyRules
//          → NeedsUnderwriter
//            → UnderwriterAlert
//              → ReturnClaimDecision
//           .out(1) → ReturnClaimDecision (↩ loop)
//          → EnsureLogSheet
//          → BuildClaimRow
//            → AppendToClaimsLog
//
// AI CONNECTIONS
// ClaimAssessmentAgent.uses({ ai_languageModel: MistralModel })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '716gDTjF9Om5eXdS',
    name: 'Insurance Claim Intake Bot',
    active: true,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class InsuranceClaimIntakeBotWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'claim-intake-hook',
        webhookId: 'claim-intake-hook-01',
        name: 'Claim Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [240, 300],
        notes: 'Intake for insurance claims from any channel (form, email, WhatsApp). Accepts policy + incident details, returns an automated claim decision.',
    })
    ClaimHook = {
        httpMethod: 'POST',
        path: 'insurance-claim',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'claim-prepare-task',
        name: 'Prepare Claim Task',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [460, 300],
        notes: 'Normalizes the claim submission into an assessment prompt.',
    })
    PrepareClaimTask = {
        jsCode: `const item = $input.first().json;
const body = item.body || item;

const description = body.description || body.incident_description || body.message || '';
if (!description) {
  throw new Error('No claim description found. Send JSON body: { "policy_number", "policy_type", "claimant_name", "incident_date", "report_date", "claimed_amount", "description" }');
}

return [{
  json: {
    policy_number: body.policy_number || 'UNKNOWN',
    policy_type: (body.policy_type || 'unknown').toLowerCase(),
    claimant_name: body.claimant_name || body.claimant || 'unknown',
    contact: body.contact || body.phone || '',
    incident_date: body.incident_date || null,
    report_date: body.report_date || new Date().toISOString().substring(0, 10),
    claimed_amount: body.claimed_amount !== undefined && body.claimed_amount !== null ? Number(body.claimed_amount) : null,
    description: description,
    channel: body.channel || 'form',
    receivedAt: new Date().toISOString(),
  },
}];`,
    };

    @node({
        id: 'claim-assessment-agent',
        name: 'Claim Assessment Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [680, 300],
        notes: 'Extracts claim type, incident facts and fraud indicators as strict JSON. Coverage and settlement decisions are made by the deterministic rules engine, not the AI.',
    })
    ClaimAssessmentAgent = {
        promptType: 'define',
        text: "={{ 'POLICY #: ' + $json.policy_number + '\\nPOLICY TYPE: ' + $json.policy_type + '\\nCLAIMANT: ' + $json.claimant_name + '\\nINCIDENT DATE: ' + ($json.incident_date || 'unknown') + '\\nREPORT DATE: ' + $json.report_date + '\\nCLAIMED AMOUNT: ' + ($json.claimed_amount === null ? 'not stated' : $json.claimed_amount) + '\\n\\nCLAIM DESCRIPTION:\\n' + $json.description }}",
        options: {
            systemMessage: `You are an Insurance Claim Assessment Assistant for a GCC insurance operation (motor, fire, marine, machinery, property, health lines).

TASK: Read the claim submission and extract structured facts for the downstream rules engine.

CLAIM TYPE RULES:
- motor (car/vehicle accidents, theft of vehicle), fire (fire damage to premises/goods), marine (cargo/shipping/hull), machinery (equipment/machinery breakdown), property (property damage, theft from premises), health (medical/injury), other.

FRAUD INDICATORS — list every one that applies from this set only:
- no_police_report (accident/theft mentioned but no police report referenced)
- inconsistent_amounts (claimed amount inconsistent with described damage)
- serial_claimant (description mentions previous recent claims)
- pressure_to_settle (urgency pressure, demands for immediate payout)
- unverified_third_party (unidentified third party or driver involved)
- minimal_evidence (no photos, invoices or documents mentioned at all)
Use an empty array if none apply. Do not invent indicators.

LOSS BAND (estimate from description only, not claimed amount):
under_5k | 5k_to_20k | 20k_to_100k | over_100k | unclear

DOCUMENTS NEEDED (standard checklist based on claim type):
motor: police report, driving license, repair estimate, photos
fire: fire brigade report, photos, fire brigade/no-objection, damage inventory
marine: bill of lading, survey report, cargo invoice
machinery: engineer report, repair invoice, purchase receipt
property: photos, police report (theft), repair quotation
health: medical report, invoices, ID

OUTPUT RULES (STRICT):
1. Respond with ONE JSON object and NOTHING else. No markdown fences.
2. Use null for unknown. Never invent facts.

JSON SCHEMA:
{
  "claim_type": "motor" | "fire" | "marine" | "machinery" | "property" | "health" | "other",
  "incident_summary": string (max 25 words),
  "extracted_amount": number | null,
  "extracted_incident_date": "YYYY-MM-DD" | null,
  "fraud_indicators": string[],
  "loss_band": "under_5k" | "5k_to_20k" | "20k_to_100k" | "over_100k" | "unclear",
  "documents_needed": string[],
  "notes": string
}`,
        },
    };

    @node({
        id: 'claim-mistral-model',
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
        id: 'claim-parse-rules',
        name: 'Parse & Apply Rules',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [900, 300],
        notes: 'Deterministic insurance rules engine: coverage matrix, reporting-delay check, fraud scoring, settlement decision, SLA and claimant reply template. AI never decides payouts.',
    })
    ParseApplyRules = {
        jsCode: `const agentOut = $input.first().json.output || '';

// Extract JSON without regex
const start = agentOut.indexOf('{');
const end = agentOut.lastIndexOf('}');
if (start === -1 || end === -1) {
  throw new Error('Agent did not return JSON. Raw output: ' + agentOut.substring(0, 200));
}
let assessment;
try {
  assessment = JSON.parse(agentOut.substring(start, end + 1));
} catch (err) {
  throw new Error('Agent JSON could not be parsed: ' + err.message);
}

const input = $('Prepare Claim Task').item.json;

// ── Coverage matrix (source of truth: code, not AI) ──
const coverageMatrix = {
  motor: ['motor'],
  fire: ['fire', 'property'],
  marine: ['marine'],
  machinery: ['machinery'],
  property: ['property', 'fire', 'theft'],
  health: ['health'],
  comprehensive: ['motor', 'fire', 'property', 'marine', 'machinery', 'health', 'theft'],
};
const claimType = assessment.claim_type || 'other';
const allowedTypes = coverageMatrix[input.policy_type] || null;
const covered = allowedTypes ? allowedTypes.includes(claimType) : null; // null = unknown policy type

// ── Reporting delay ──
const incidentDate = assessment.extracted_incident_date || input.incident_date;
let delayDays = null;
if (incidentDate) {
  const dIncident = new Date(incidentDate);
  const dReport = new Date(input.report_date);
  if (!isNaN(dIncident.getTime()) && !isNaN(dReport.getTime())) {
    delayDays = Math.round((dReport - dIncident) / 86400000);
  }
}

// ── Fraud scoring ──
const indicators = Array.isArray(assessment.fraud_indicators) ? assessment.fraud_indicators : [];
let fraudScore = indicators.length;
const flags = [];
if (delayDays !== null && delayDays > 30) {
  fraudScore += 2;
  flags.push({ code: 'LATE_REPORTING', severity: 'WARNING', message: 'Claim reported ' + delayDays + ' days after incident (policy limit: 30 days)' });
}
if (covered === false) {
  flags.push({ code: 'COVERAGE_MISMATCH', severity: 'ERROR', message: 'Policy type "' + input.policy_type + '" does not cover "' + claimType + '" claims' });
}
if (covered === null) {
  flags.push({ code: 'UNKNOWN_POLICY_TYPE', severity: 'WARNING', message: 'Policy type "' + input.policy_type + '" not recognized — underwriter must verify policy schedule' });
}

// ── Settlement decision ──
const claimedAmount = input.claimed_amount !== null ? input.claimed_amount : (Number(assessment.extracted_amount) || 0);
let decision;
if (covered === false) {
  decision = 'underwriter_review';
} else if (fraudScore >= 3) {
  decision = 'investigate';
} else if (claimedAmount > 0 && claimedAmount <= 2000 && fraudScore === 0 && covered === true) {
  decision = 'auto_settle';
} else if (claimedAmount > 0 && claimedAmount <= 10000 && fraudScore <= 1 && covered !== false) {
  decision = 'fast_track';
} else {
  decision = 'underwriter_review';
}

const slaMap = { auto_settle: '24 hours', fast_track: '48 hours', underwriter_review: '5 working days', investigate: '10 working days' };
const decisionLabels = { auto_settle: 'Auto-Settle Approved', fast_track: 'Fast-Track Processing', underwriter_review: 'Underwriter Review Required', investigate: 'Special Investigation Unit' };

// ── Deterministic claimant reply (audit-friendly templates) ──
const replyMap = {
  auto_settle: 'Dear ' + input.claimant_name + ', good news. Your claim on policy ' + input.policy_number + ' has been approved for fast settlement of up to QAR ' + claimedAmount.toLocaleString() + '. Payment is expected within 24 hours after final document verification.',
  fast_track: 'Dear ' + input.claimant_name + ', your claim on policy ' + input.policy_number + ' has been accepted and is being fast-tracked. Expected decision within 48 hours. Our team will contact you if any additional document is required.',
  underwriter_review: 'Dear ' + input.claimant_name + ', thank you for submitting your claim on policy ' + input.policy_number + '. Your case has been assigned to an underwriter and a decision is expected within 5 working days. Please keep the listed documents ready.',
  investigate: 'Dear ' + input.claimant_name + ', your claim on policy ' + input.policy_number + ' has been received and is undergoing standard verification. A claims officer will contact you within 10 working days. Please retain all supporting documents.',
};

return [{
  json: {
    claim: {
      policy_number: input.policy_number,
      policy_type: input.policy_type,
      claimant_name: input.claimant_name,
      claim_type: claimType,
      incident_summary: assessment.incident_summary,
      claimed_amount: claimedAmount,
      incident_date: incidentDate,
      delay_days: delayDays,
      loss_band: assessment.loss_band,
      documents_needed: assessment.documents_needed || [],
    },
    decision: decision,
    decision_label: decisionLabels[decision],
    covered: covered,
    fraud_indicators: indicators,
    fraud_score: fraudScore,
    flags: flags,
    sla_target: slaMap[decision],
    claimant_reply: replyMap[decision],
    processed_at: new Date().toISOString(),
  },
}];`,
    };

    @node({
        id: 'claim-ensure-sheet',
        name: 'Ensure Log Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1120, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'Creates the Claims_Log tab on first run. Errors (tab exists, credential gap) never block the claim decision.',
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
        title: 'Claims_Log',
        options: {},
    };

    @node({
        id: 'claim-build-row',
        name: 'Build Claim Row',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1030, 460],
        notes: 'Flattens the triage result into one row; autoMapInputData creates headers on the empty sheet.',
    })
    BuildClaimRow = {
        jsCode: `const src = $('Parse & Apply Rules').item.json;
return [{
  json: {
    'Timestamp': src.processed_at,
    'Policy #': src.claim.policy_number,
    'Policy Type': src.claim.policy_type,
    'Claimant': src.claim.claimant_name,
    'Claim Type': src.claim.claim_type,
    'Claimed Amount': src.claim.claimed_amount,
    'Decision': src.decision,
    'Fraud Score': src.fraud_score,
    'Delay Days': src.claim.delay_days,
    'Covered': src.covered === true ? 'yes' : (src.covered === false ? 'NO' : 'unknown'),
    'SLA Target': src.sla_target,
    'Flags': src.flags.map(function(f) { return f.code; }).join(', ') || 'none',
  },
}];`,
    };

    @node({
        id: 'claim-append-log',
        name: 'Append to Claims Log',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1340, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        notes: 'One row per claim with decision audit trail. onError continue keeps the API response intact.',
    })
    AppendToClaimsLog = {
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
            value: 'Claims_Log',
        },
        columns: {
            mappingMode: 'autoMapInputData',
        },
        options: {},
    };

    @node({
        id: 'claim-needs-underwriter',
        name: 'Needs Underwriter?',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [1560, 300],
        notes: 'True when the decision requires a human (underwriter review or special investigation). Fires the Mattermost alert.',
    })
    NeedsUnderwriter = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'cond-underwriter',
                    leftValue: "={{ $('Parse & Apply Rules').item.json.decision }}",
                    rightValue: 'underwriter_review',
                    operator: {
                        type: 'string',
                        operation: 'equals',
                    },
                },
                {
                    id: 'cond-investigate',
                    leftValue: "={{ $('Parse & Apply Rules').item.json.decision }}",
                    rightValue: 'investigate',
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
        id: 'claim-underwriter-alert',
        name: 'Underwriter Alert',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.5,
        position: [1780, 180],
        notes: 'Posts claims needing human attention to the Mattermost claims channel with fraud score and flags.',
    })
    UnderwriterAlert = {
        method: 'POST',
        url: 'http://host.docker.internal:8065/hooks/zceo56iq8b8mdpkzfj3ehan6ny',
        authentication: 'none',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ text: '⚖️ *CLAIM ASSIGNED — ' + $('Parse & Apply Rules').item.json.decision_label + '*\\n\\n*Policy #:* ' + $('Parse & Apply Rules').item.json.claim.policy_number + ' (' + $('Parse & Apply Rules').item.json.claim.policy_type + ')\\n*Claimant:* ' + $('Parse & Apply Rules').item.json.claim.claimant_name + '\\n*Claim type:* ' + $('Parse & Apply Rules').item.json.claim.claim_type + '\\n*Claimed:* QAR ' + $('Parse & Apply Rules').item.json.claim.claimed_amount + ' · loss band: ' + $('Parse & Apply Rules').item.json.claim.loss_band + '\\n*Reporting delay:* ' + ($('Parse & Apply Rules').item.json.claim.delay_days === null ? 'unknown' : $('Parse & Apply Rules').item.json.claim.delay_days + ' days') + '\\n*Fraud score:* ' + $('Parse & Apply Rules').item.json.fraud_score + ($('Parse & Apply Rules').item.json.fraud_indicators.length ? ' [' + $('Parse & Apply Rules').item.json.fraud_indicators.join(', ') + ']' : '') + '\\n*SLA:* ' + $('Parse & Apply Rules').item.json.sla_target + '\\n\\n*Flags:* ' + ($('Parse & Apply Rules').item.json.flags.map(function(f) { return f.code; }).join(', ') || 'none') + '\\n\\n*Summary:* ' + $('Parse & Apply Rules').item.json.claim.incident_summary }) }}",
        options: {},
    };

    @node({
        id: 'claim-return-decision',
        name: 'Return Claim Decision',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.5,
        position: [2000, 300],
        notes: 'Returns the full claim decision package as JSON: decision, coverage verdict, fraud assessment, documents checklist and claimant reply.',
    })
    ReturnClaimDecision = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify({ status: $('Parse & Apply Rules').item.json.decision, decision_label: $('Parse & Apply Rules').item.json.decision_label, claim: $('Parse & Apply Rules').item.json.claim, covered: $('Parse & Apply Rules').item.json.covered, fraud_score: $('Parse & Apply Rules').item.json.fraud_score, fraud_indicators: $('Parse & Apply Rules').item.json.fraud_indicators, flags: $('Parse & Apply Rules').item.json.flags, sla_target: $('Parse & Apply Rules').item.json.sla_target, claimant_reply: $('Parse & Apply Rules').item.json.claimant_reply, logged_to_sheets: true }) }}",
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ClaimHook.out(0).to(this.PrepareClaimTask.in(0));
        this.PrepareClaimTask.out(0).to(this.ClaimAssessmentAgent.in(0));
        this.ClaimAssessmentAgent.out(0).to(this.ParseApplyRules.in(0));
        this.ParseApplyRules.out(0).to(this.NeedsUnderwriter.in(0));
        this.ParseApplyRules.out(0).to(this.EnsureLogSheet.in(0));
        this.ParseApplyRules.out(0).to(this.BuildClaimRow.in(0));
        this.BuildClaimRow.out(0).to(this.AppendToClaimsLog.in(0));
        this.NeedsUnderwriter.out(0).to(this.UnderwriterAlert.in(0));
        this.NeedsUnderwriter.out(1).to(this.ReturnClaimDecision.in(0));
        this.UnderwriterAlert.out(0).to(this.ReturnClaimDecision.in(0));

        this.ClaimAssessmentAgent.uses({
            ai_languageModel: this.MistralModel.output,
        });
    }
}
