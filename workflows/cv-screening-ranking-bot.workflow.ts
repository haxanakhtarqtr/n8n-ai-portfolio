import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : CV Screening & Ranking Bot
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// CvIntakeForm                       formTrigger
// ExtractCvText                      extractFromFile
// ScoreCvAi                          agent                      [AI] [retry]
// GroqModel                          lmChatGroq                 [creds] [ai_languageModel]
// ParseValidate                      code
// EnsureLogSheet                     googleSheets               [onError→regular] [creds]
// AppendToCvScreeningLog             googleSheets               [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// CvIntakeForm
//    → ExtractCvText
//      → ScoreCvAi
//        → ParseValidate
//          → AppendToCvScreeningLog
//          → EnsureLogSheet
//
// AI CONNECTIONS
// ScoreCvAi.uses({ ai_languageModel: GroqModel })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'CsJMNesuWyxADFyh',
    name: 'CV Screening & Ranking Bot',
    active: true,
    isArchived: false,
    projectId: 'WkdztVBhxnc914pU',
    settings: {
        saveExecutionProgress: true,
        saveManualExecutions: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        executionOrder: 'v1',
        binaryMode: 'separate',
    },
})
export class CvScreeningRankingBotWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'a1f0c2d3-0001-4a5b-8c6d-cv0000000001',
        webhookId: 'cv-screening-form-hook-0001',
        name: 'CV Intake Form',
        type: 'n8n-nodes-base.formTrigger',
        version: 2.6,
        position: [-560, 224],
    })
    CvIntakeForm = {
        formTitle: 'CV Screening & Ranking',
        formDescription:
            'Upload a candidate CV (PDF) with the job description. The AI scores the fit and logs the result to Google Sheets.',
        formFields: {
            values: [
                {
                    fieldLabel: 'Candidate Name',
                    requiredField: true,
                },
                {
                    fieldLabel: 'Candidate Email',
                    fieldType: 'email',
                    requiredField: true,
                },
                {
                    fieldLabel: 'Role Title',
                    placeholder: 'e.g. Senior Backend Developer',
                    requiredField: true,
                },
                {
                    fieldLabel: 'Job Description',
                    fieldType: 'textarea',
                    placeholder: 'Paste the job description here...',
                    requiredField: true,
                },
                {
                    fieldLabel: 'CV',
                    fieldType: 'file',
                    multipleFiles: false,
                    acceptFileTypes: '.pdf',
                    requiredField: true,
                },
            ],
        },
        options: {
            path: 'cv-screening',
        },
    };

    @node({
        id: 'a1f0c2d3-0002-4a5b-8c6d-cv0000000002',
        name: 'Extract CV Text',
        type: 'n8n-nodes-base.extractFromFile',
        version: 1.1,
        position: [-336, 224],
    })
    ExtractCvText = {
        operation: 'pdf',
        binaryPropertyName: 'CV',
        options: {
            joinPages: true,
        },
    };

    @node({
        id: 'a1f0c2d3-0003-4a5b-8c6d-cv0000000003',
        name: 'Score CV (AI)',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [-112, 224],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    ScoreCvAi = {
        promptType: 'define',
        text: `=Candidate: {{ $json['Candidate Name'] }}
Role Title: {{ $json['Role Title'] }}

JOB DESCRIPTION:
{{ $json['Job Description'] }}

CV CONTENT:
{{ $json.text || $json.cvText || '(no text could be extracted from the file)' }}`,
        options: {
            systemMessage: `You are a technical recruiter AI. Score how well the CV matches the job description.

OUTPUT RULES (STRICT):
1. Respond with ONE JSON object and NOTHING else. No explanations, no markdown fences.
2. Never invent facts not present in the CV. Use null when unknown.
3. match_score must be an integer between 0 and 100 reflecting overall fit (skills, experience, seniority, domain).
4. key_strengths and skill_gaps must each be arrays of short strings (max 5 items).

JSON SCHEMA:
{
  "match_score": integer 0-100,
  "verdict": "Strong Match" | "Good Match" | "Partial Match" | "Poor Match",
  "experience_years": number,
  "summary": string (2-3 sentences),
  "key_strengths": [string],
  "skill_gaps": [string],
  "notable_red_flags": string,
  "recommended_next_step": string
}`,
        },
    };

    @node({
        id: 'a1f0c2d3-0004-4a5b-8c6d-cv0000000004',
        name: 'Groq Model',
        type: '@n8n/n8n-nodes-langchain.lmChatGroq',
        version: 1,
        position: [-40, 456],
        credentials: { groqApi: { id: '6VUycnVaIxEH5YXv', name: 'Groq account' } },
    })
    GroqModel = {
        model: 'openai/gpt-oss-120b',
        options: {},
    };

    @node({
        id: 'a1f0c2d3-0005-4a5b-8c6d-cv0000000005',
        name: 'Parse & Validate',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 224],
    })
    ParseValidate = {
        jsCode: `const raw = $json.output ?? $json.text ?? '';
let txt = String(raw).trim()
  .replace(/^\`\`\`json\\s*/i, '')
  .replace(/^\`\`\`\\s*/, '')
  .replace(/\`\`\`\\s*$/, '')
  .trim();

let parsed;
try {
  parsed = JSON.parse(txt);
} catch (e) {
  const m = txt.match(/\\{[\\s\\S]*\\}/);
  if (!m) throw new Error('AI did not return JSON: ' + txt.slice(0, 200));
  parsed = JSON.parse(m[0]);
}

const arr = v => Array.isArray(v) ? v.join('; ') : (v ?? '');
const form = $('CV Intake Form').item.json;

return [{ json: {
  scored_at: new Date().toISOString(),
  candidate: form['Candidate Name'],
  email: form['Candidate Email'],
  role: form['Role Title'],
  match_score: Number(parsed.match_score ?? 0),
  verdict: parsed.verdict ?? 'Unknown',
  experience_years: parsed.experience_years ?? null,
  summary: parsed.summary ?? '',
  key_strengths: arr(parsed.key_strengths),
  skill_gaps: arr(parsed.skill_gaps),
  red_flags: parsed.notable_red_flags ?? '',
  next_step: parsed.recommended_next_step ?? ''
}}];`,
    };

    @node({
        id: 'a1f0c2d3-0006-4a5b-8c6d-cv0000000006',
        name: 'Ensure Log Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [464, 128],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
    })
    EnsureLogSheet = {
        operation: 'create',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        title: 'CV_Screening_Log',
        options: {},
    };

    @node({
        id: 'a1f0c2d3-0007-4a5b-8c6d-cv0000000007',
        name: 'Append to CV Screening Log',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [464, 320],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
    })
    AppendToCvScreeningLog = {
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
            value: 'CV_Screening_Log',
        },
        columns: {
            mappingMode: 'autoMapInputData',
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.CvIntakeForm.out(0).to(this.ExtractCvText.in(0));
        this.ExtractCvText.out(0).to(this.ScoreCvAi.in(0));
        this.ScoreCvAi.out(0).to(this.ParseValidate.in(0));
        this.ParseValidate.out(0).to(this.AppendToCvScreeningLog.in(0));
        this.ParseValidate.out(0).to(this.EnsureLogSheet.in(0));

        this.ScoreCvAi.uses({
            ai_languageModel: this.GroqModel.output,
        });
    }
}
