import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Voice Note to Task - Audio AI
// Nodes   : 13  |  Connections: 13
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// VoiceTaskHook                      webhook
// EnsureTasksTab                     googleSheets               [onError→regular] [creds] [alwaysOutput]
// ReadTasks                          googleSheets               [onError→regular] [creds] [alwaysOutput] [retry]
// BuildContext                       code
// TranscribeVoice                    httpRequest                [onError→regular] [creds] [alwaysOutput] [retry]
// ExtractTask                        httpRequest                [creds] [retry]
// ValidateTask                       code
// IfLogWorthy                        if
// ShapeTaskRow                       code
// AppendTask                         googleSheets               [creds] [retry]
// BuildTaskResponse                  code
// ReturnTaskResponse                 respondToWebhook
// ConvertToFile                      convertToFile
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// VoiceTaskHook
//    → ReadTasks
//      → BuildContext
//        → ConvertToFile
//          → TranscribeVoice
//            → ExtractTask
//              → ValidateTask
//                → IfLogWorthy
//                  → ShapeTaskRow
//                    → AppendTask
//                      → BuildTaskResponse
//                        → ReturnTaskResponse
//                 .out(1) → BuildTaskResponse (↩ loop)
//    → EnsureTasksTab
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'L5IOGaIqbTkGQycu',
    name: 'Voice Note to Task - Audio AI',
    active: true,
    isArchived: false,
    projectId: 'WkdztVBhxnc914pU',
})
export class VoiceNoteToTaskAudioAiWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'vt000001-0001-4b2c-9d3e-vt0000000001',
        webhookId: 'voice-task-hook-01',
        name: 'Voice Task Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-1140, 0],
        notes: 'Voice intake: POST { audio_base64, mime_type }.',
    })
    VoiceTaskHook = {
        httpMethod: 'POST',
        path: 'voice-task',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'vt000001-0002-4b2c-9d3e-vt0000000002',
        name: 'Ensure Tasks Tab',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-920, -260],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
    })
    EnsureTasksTab = {
        resource: 'sheet',
        operation: 'create',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        title: 'Tasks',
        options: {},
    };

    @node({
        id: 'vt000001-0003-4b2c-9d3e-vt0000000003',
        name: 'Read Tasks',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-920, 0],
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
        id: 'vt000001-0004-4b2c-9d3e-vt0000000004',
        name: 'Build Context',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-700, 0],
    })
    BuildContext = {
        jsCode: `// ============================================================
// CONTEXT BUILDER - collapses the loaded task log into one item
// carrying existing rows (for duplicate detection) + the audio
// payload as base64 for the Convert To File node.
// ============================================================
const hook = $('Voice Task Hook').item.json;
const body = (hook.body && typeof hook.body === 'object') ? hook.body : hook;
const logRows = $input.all()
  .map(i => i.json)
  .filter(r => r && r.task_id && String(r.task_id).trim() !== '');

const mime = (body.mime_type || body.mimeType || 'audio/wav').toLowerCase();
const audioB64 = body.audio_base64 || null;

return [{ json: {
  log_rows: logRows.map(r => ({ task_id: r.task_id, transcript_hash: String(r.transcript_hash ?? ''), status: r.status })),
  log_size: logRows.length,
  request: { submitted_by: body.submitted_by || 'demo', note: body.note || '' },
  audio_b64: audioB64,
  mime
}}];`,
    };

    @node({
        id: 'vt000001-0005-4b2c-9d3e-vt0000000005',
        name: 'Transcribe Voice',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-480, 0],
        credentials: { groqApi: { id: '6VUycnVaIxEH5YXv', name: 'Groq account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 5000,
    })
    TranscribeVoice = {
        method: 'POST',
        url: 'https://api.groq.com/openai/v1/audio/transcriptions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'groqApi',
        sendBody: true,
        contentType: 'multipart-form-data',
        bodyParameters: {
            parameters: [
                {
                    name: 'model',
                    value: 'whisper-large-v3-turbo',
                },
                {
                    name: 'response_format',
                    value: 'json',
                },
                {
                    parameterType: 'formBinaryData',
                    name: 'file',
                    inputDataFieldName: 'data',
                },
            ],
        },
        options: {
            timeout: 90000,
        },
    };

    @node({
        id: 'vt000001-0006-4b2c-9d3e-vt0000000006',
        name: 'Extract Task',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-260, 0],
        credentials: { groqApi: { id: '6VUycnVaIxEH5YXv', name: 'Groq account' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    ExtractTask = {
        method: 'POST',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'groqApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            '={{ JSON.stringify({ model: \'openai/gpt-oss-120b\', temperature: 0.1, max_tokens: 500, response_format: { type: \'json_object\' }, messages: [ { role: \'system\', content: "You turn a voice-note transcript into ONE strict task record. Output ONLY the JSON object.\\n\\nOUTPUT SCHEMA:\\n{\\"title\\": \\"<short imperative task title, max 8 words, in English>\\", \\"details\\": \\"<one sentence capturing the substance, or empty string>\\", \\"deadline_raw\\": \\"<the exact words from the transcript that express WHEN, e.g. tomorrow at 2 PM, next Monday - or null if none>\\", \\"priority\\": \\"<high|medium|low>\\", \\"assignee\\": \\"<person name or null>\\", \\"category_hint\\": \\"<meeting|call|follow-up|payment|document|shipment|personal|other>\\"}\\n\\nRULES:\\n- title and details in English even if the transcript is in another language.\\n- priority: high if the speaker stressed urgency/ASAP/high priority, low if explicitly said low/no rush, otherwise medium.\\n- deadline_raw: copy the speaker words that express when - do NOT convert to dates.\\n- If the transcript is small talk, weather commentary, or anything that is NOT a task, reminder, or instruction, output {\\"off_topic\\": true} and nothing else." }, { role: \'user\', content: \'TRANSCRIPT: \' + ($json.text || \'\') + \'\\n\\nExtract the task record now.\' } ] }) }}',
        options: {
            timeout: 60000,
        },
    };

    @node({
        id: 'vt000001-0007-4b2c-9d3e-vt0000000007',
        name: 'Validate Task',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-40, 0],
    })
    ValidateTask = {
        jsCode: `// ============================================================
// TASK VALIDATOR - deterministic. The LLM extracts WORDS; this
// code resolves dates, whitelists enums, detects duplicates.
// ============================================================
const ctx = $('Build Context').item.json;
const tItem = $('Transcribe Voice').item.json;
if (tItem.error && !tItem.text) {
  return [{ json: { decision: 'skip', status: 'transcription_failed', transcript: '', extracted: null, flags: ['transcription error: ' + (tItem.error?.message ?? JSON.stringify(tItem.error).slice(0, 200))], log_size: ctx.log_size, request: ctx.request } }];
}
const transcript = String(tItem.text ?? '').trim();

if (!transcript || transcript.length < 3) {
  return [{ json: { decision: 'skip', status: 'no_speech', transcript, extracted: null, flags: ['transcription produced no speech text'], log_size: ctx.log_size, request: ctx.request } }];
}

const transcriptHash = transcript.toLowerCase().replace(/\\s+/g, ' ').trim().slice(0, 120);

let raw;
try {
  let txt = String(($json.choices || [])[0]?.message?.content ?? '');
  txt = txt.replace(/\`\`\`json|\`\`\`/g, '').trim();
  raw = JSON.parse(txt);
} catch (e) {
  return [{ json: { decision: 'log', status: 'needs_review', parse_error: 'extraction JSON unparseable: ' + e.message, transcript, transcriptHash, extracted: null, flags: ['unparseable_extraction'], checks: [], log_size: ctx.log_size, request: ctx.request } }];
}

if (raw.off_topic) {
  return [{ json: { decision: 'skip', status: 'off_topic', transcript, transcriptHash, extracted: null, flags: ['audio is not a task, reminder or instruction'], checks: [], log_size: ctx.log_size, request: ctx.request } }];
}

const flags = [];
const checks = [];

const title = raw.title ? String(raw.title).trim() : '';
const details = raw.details ? String(raw.details).trim() : '';
const assignee = raw.assignee ? String(raw.assignee).trim() : null;
const deadlineRaw = raw.deadline_raw ? String(raw.deadline_raw).trim() : null;

if (!title) flags.push('no task title could be extracted');
checks.push({ check: 'task title present', pass: !!title });

const PRIO = ['high', 'medium', 'low'];
let priority = PRIO.includes(String(raw.priority ?? '').toLowerCase()) ? String(raw.priority).toLowerCase() : 'medium';
if (raw.priority && !PRIO.includes(String(raw.priority).toLowerCase())) flags.push('priority not in whitelist - defaulted to medium');
checks.push({ check: 'priority whitelisted', pass: true });

// DEADLINE RESOLUTION - code resolves the speaker's words to a
// real date, anchored on today. The LLM only supplies the words.
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = d => d.toISOString().slice(0, 10);
const today = new Date(); today.setHours(0, 0, 0, 0);
const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

let dueDate = null, dueTime = null, deadlineNote = null;
if (deadlineRaw) {
  let s = deadlineRaw.toLowerCase().replace(/\\u00a0/g, ' ');
  const t12 = s.match(/\\b(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)\\b/);
  const t24 = s.match(/\\b([01]?\\d|2[0-3]):([0-5]\\d)\\b/);
  if (t12) {
    let hr = parseInt(t12[1], 10); const mn = t12[2] ? parseInt(t12[2], 10) : 0;
    if (/p/.test(t12[3]) && hr !== 12) hr += 12;
    if (/a/.test(t12[3]) && hr === 12) hr = 0;
    dueTime = String(hr).padStart(2, '0') + ':' + String(mn).padStart(2, '0');
  } else if (t24) {
    dueTime = t24[1].padStart(2, '0') + ':' + t24[2];
  }

  if (/day after tomorrow/.test(s)) dueDate = iso(addDays(today, 2));
  else if (/tomorrow|\\bkal\\b/.test(s)) dueDate = iso(addDays(today, 1));
  else if (/\\btoday\\b|\\baaj\\b/.test(s)) dueDate = iso(today);
  else {
    const mIn = s.match(/in\\s+(\\d+)\\s+(day|week|month)s?/);
    const mNext = s.match(/next\\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b/);
    const mDay = s.match(/\\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\\b/);
    const mIso = s.match(/\\b(20\\d{2})-(\\d{1,2})-(\\d{1,2})\\b/);
    const mDmy = s.match(/\\b(\\d{1,2})\\/(\\d{1,2})(?:\\/(20\\d{2}))?\\b/);
    const mMon = s.match(/\\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+(\\d{1,2})\\b/);
    if (mIn) {
      const n = parseInt(mIn[1], 10);
      const mult = mIn[2] === 'week' ? 7 : mIn[2] === 'month' ? 30 : 1;
      dueDate = iso(addDays(today, n * mult));
    } else if (mNext) {
      const target = WD.indexOf(mNext[1]);
      let diff = (target - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      dueDate = iso(addDays(today, diff));
      deadlineNote = 'resolved from: ' + deadlineRaw;
    } else if (mIso) {
      dueDate = mIso[1] + '-' + mIso[2].padStart(2, '0') + '-' + mIso[3].padStart(2, '0');
    } else if (mDmy) {
      const yr = mDmy[3] ? parseInt(mDmy[3], 10) : today.getFullYear();
      dueDate = yr + '-' + mDmy[2].padStart(2, '0') + '-' + mDmy[1].padStart(2, '0');
    } else if (mMon) {
      const MO = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
      const mo = MO[mMon[1]];
      let yr = today.getFullYear();
      if (iso(today).slice(5) > mo + '-' + mMon[2].padStart(2, '0')) yr += 1;
      dueDate = yr + '-' + mo + '-' + mMon[2].padStart(2, '0');
    } else if (mDay) {
      const target = WD.indexOf(mDay[1]);
      let diff = (target - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      dueDate = iso(addDays(today, diff));
      deadlineNote = 'resolved from: ' + deadlineRaw;
    } else {
      flags.push('deadline could not be resolved to a date');
    }
  }
  checks.push({ check: 'deadline resolved', pass: !!dueDate });
} else {
  checks.push({ check: 'deadline (none given)', pass: true });
}

if (dueDate) {
  const dd = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.round((dd - today) / 86400000);
  if (diffDays < 0) flags.push('resolved deadline is in the past: ' + dueDate);
  else if (diffDays > 365) flags.push('resolved deadline is more than a year out: ' + dueDate);
  checks.push({ check: 'deadline sanity', pass: diffDays >= 0 && diffDays <= 365 });
}

const CAT_MAP = [
  ['meeting', /meeting|schedule|calendar|sync|review session|standup/i],
  ['call', /call|phone|ring|dial/i],
  ['follow-up', /follow|check in|remind|pending|chase/i],
  ['payment', /invoice|payment|pay|bill|budget|reimburse/i],
  ['document', /document|report|draft|write|file|contract|cv/i],
  ['shipment', /ship|deliver|courier|dispatch|pickup/i],
  ['personal', /personal|birthday|family|gift|doctor/i]
];
let category = 'other';
const hay = title + ' ' + details + ' ' + (deadlineRaw ?? '');
for (const [cat, re] of CAT_MAP) { if (re.test(hay)) { category = cat; break; } }
if (category === 'other' && raw.category_hint && raw.category_hint !== 'other') {
  const known = CAT_MAP.map(c => c[0]);
  const guess = known.find(k => String(raw.category_hint).toLowerCase().includes(k));
  if (guess) category = guess;
}

let duplicateOf = null;
for (const r of ctx.log_rows) {
  if (r.transcript_hash && r.transcript_hash === transcriptHash) { duplicateOf = r.task_id; break; }
}
if (duplicateOf) flags.push('duplicate of ' + duplicateOf + ' (transcript hash match)');
checks.push({ check: 'duplicate hash', pass: !duplicateOf });

let status, decision;
if (duplicateOf) { status = 'duplicate'; decision = 'skip'; }
else if (flags.some(f => !f.startsWith('duplicate of')) || !title) { status = 'needs_review'; decision = 'log'; }
else { status = 'valid'; decision = 'log'; }

const now = new Date();
const taskId = 'TSK-' + now.toISOString().slice(0, 10).replace(/-/g, '') + '-' + now.toTimeString().slice(0, 8).replace(/:/g, '');

return [{ json: {
  decision, status, category, priority,
  task_id: taskId,
  duplicate_of: duplicateOf,
  transcript, transcript_hash: transcriptHash,
  extracted: { title, details, deadline_raw: deadlineRaw, assignee },
  due_date: dueDate, due_time: dueTime, deadline_note: deadlineNote,
  checks, flags,
  log_size: ctx.log_size, request: ctx.request
}}];`,
    };

    @node({
        id: 'vt000001-0008-4b2c-9d3e-vt0000000008',
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
        id: 'vt000001-0009-4b2c-9d3e-vt0000000009',
        name: 'Shape Task Row',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [400, -160],
    })
    ShapeTaskRow = {
        mode: 'runOnceForEachItem',
        jsCode: `// shape one clean row for the Sheets log
const v = $json;
return {
  json: {
    task_id: v.task_id,
    transcript: v.transcript,
    transcript_hash: v.transcript_hash,
    task_title: v.extracted?.title ?? '',
    details: v.extracted?.details ?? '',
    due_date: v.due_date ?? '',
    due_time: v.due_time ?? '',
    priority: v.priority ?? 'medium',
    category: v.category ?? 'other',
    assignee: v.extracted?.assignee ?? '',
    status: v.status,
    flags: (v.flags || []).join('; '),
    submitted_by: v.request?.submitted_by ?? '',
    logged_at: new Date().toISOString()
  }
};`,
    };

    @node({
        id: 'vt000001-0010-4b2c-9d3e-vt0000000010',
        name: 'Append Task',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [400, -320],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    AppendTask = {
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
            value: 'Tasks',
        },
        columns: {
            mappingMode: 'autoMapInputData',
            matchingColumns: [],
            schema: [],
        },
        options: {},
    };

    @node({
        id: 'vt000001-0011-4b2c-9d3e-vt0000000011',
        name: 'Build Task Response',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [640, 0],
    })
    BuildTaskResponse = {
        jsCode: `// assemble the final API response - decision path is fully deterministic
const v = $('Validate Task').item.json;
const payload = {
  status: v.status,
  task_id: v.decision === 'log' ? v.task_id : null,
  transcript: v.transcript ?? null,
  category: v.decision === 'log' ? v.category : null,
  priority: v.decision === 'log' ? v.priority : null,
  due_date: v.decision === 'log' ? v.due_date : null,
  due_time: v.decision === 'log' ? v.due_time : null,
  extracted: v.extracted,
  validation: { checks: v.checks, flags: v.flags },
  duplicate_of: v.duplicate_of,
  logged_to_sheet: v.decision === 'log',
  stats: { tasks_on_file: v.log_size },
  engine: {
    transcription: 'groq whisper-large-v3-turbo (multipart binary)',
    extraction: 'groq gpt-oss-120b (temp 0.1, strict JSON, words only)',
    deadline_resolution: 'deterministic date parser in code, anchored on today',
    category_priority: 'deterministic keyword map + enum whitelist in code',
    storage: 'google sheets Tasks log'
  }
};
if (v.parse_error) payload.parse_error = v.parse_error;
if (v.deadline_note) payload.deadline_note = v.deadline_note;
return [{ json: payload }];`,
    };

    @node({
        id: 'vt000001-0012-4b2c-9d3e-vt0000000012',
        name: 'Return Task Response',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [860, 0],
    })
    ReturnTaskResponse = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify($json) }}',
    };

    @node({
        id: 'vt000001-0004b-4b2c-9d3e-vt0000000004b',
        name: 'Convert To File',
        type: 'n8n-nodes-base.convertToFile',
        version: 1.1,
        position: [-590, 0],
    })
    ConvertToFile = {
        operation: 'toBinary',
        sourceProperty: 'audio_b64',
        options: {
            mimeType: '={{ $json.mime }}',
            fileName:
                "={{ 'voice-note.' + ($json.mime.includes('wav') ? 'wav' : $json.mime.includes('webm') ? 'webm' : ($json.mime.includes('mpeg') || $json.mime.includes('mp3')) ? 'mp3' : ($json.mime.includes('mp4') || $json.mime.includes('m4a')) ? 'm4a' : $json.mime.includes('ogg') ? 'ogg' : $json.mime.includes('flac') ? 'flac' : 'webm') }}",
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.VoiceTaskHook.out(0).to(this.ReadTasks.in(0));
        this.VoiceTaskHook.out(0).to(this.EnsureTasksTab.in(0));
        this.ReadTasks.out(0).to(this.BuildContext.in(0));
        this.BuildContext.out(0).to(this.ConvertToFile.in(0));
        this.ConvertToFile.out(0).to(this.TranscribeVoice.in(0));
        this.TranscribeVoice.out(0).to(this.ExtractTask.in(0));
        this.ExtractTask.out(0).to(this.ValidateTask.in(0));
        this.ValidateTask.out(0).to(this.IfLogWorthy.in(0));
        this.IfLogWorthy.out(0).to(this.ShapeTaskRow.in(0));
        this.IfLogWorthy.out(1).to(this.BuildTaskResponse.in(0));
        this.ShapeTaskRow.out(0).to(this.AppendTask.in(0));
        this.AppendTask.out(0).to(this.BuildTaskResponse.in(0));
        this.BuildTaskResponse.out(0).to(this.ReturnTaskResponse.in(0));
    }
}
