import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Interview Scheduler
// Nodes   : 9  |  Connections: 8
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// InterviewRequestHook               webhook
// EnsureScheduleSheet                googleSheets               [onError→regular] [creds] [retry]
// LoadBookedSlots                    googleSheets               [onError→regular] [creds] [alwaysOutput] [retry]
// PickInterviewSlot                  code
// BuildBookingRow                    code
// BookSlot                           googleSheets               [creds] [retry]
// BuildConfirmation                  code
// SendConfirmation                   gmail                      [onError→regular] [creds]
// ReturnBookingResult                respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// InterviewRequestHook
//    → LoadBookedSlots
//      → PickInterviewSlot
//        → BuildBookingRow
//          → BookSlot
//            → BuildConfirmation
//              → SendConfirmation
//                → ReturnBookingResult
//    → EnsureScheduleSheet
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'tLcwfbniIoh0kxQO',
    name: 'Interview Scheduler',
    active: true,
    isArchived: false,
    projectId: 'WkdztVBhxnc914pU',
    settings: {
        saveExecutionProgress: true,
        saveManualExecutions: true,
        saveDataErrorExecution: 'all',
        saveDataSuccessExecution: 'all',
        executionOrder: 'v1',
    },
})
export class InterviewSchedulerWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'b2e1f0a1-0001-4b2c-9d3e-is0000000001',
        webhookId: 'interview-scheduler-hook-01',
        name: 'Interview Request Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-620, 300],
        notes: 'Intake: { name, email, role }. Recruiter or automation posts a candidate who passed CV screening.',
    })
    InterviewRequestHook = {
        httpMethod: 'POST',
        path: 'interview-scheduler',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'b2e1f0a1-0002-4b2c-9d3e-is0000000002',
        name: 'Ensure Schedule Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-400, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    EnsureScheduleSheet = {
        resource: 'sheet',
        operation: 'create',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        title: 'Interview_Schedule',
        options: {},
    };

    @node({
        id: 'b2e1f0a1-0003-4b2c-9d3e-is0000000003',
        name: 'Load Booked Slots',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-180, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    LoadBookedSlots = {
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
            value: 'Interview_Schedule',
        },
        options: {},
    };

    @node({
        id: 'b2e1f0a1-0004-4b2c-9d3e-is0000000004',
        name: 'Pick Interview Slot',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [40, 300],
    })
    PickInterviewSlot = {
        jsCode: `// ============================================================
// DETERMINISTIC SLOT ENGINE — AI never picks the slot.
// Edit CONFIG to match the interviewer's real availability.
// ============================================================
const CONFIG = {
  slotHours: [10, 11, 14, 15],   // interview start hours, Asia/Qatar
  workDays: [0, 1, 2, 3, 4],     // Sun(0) .. Thu(4) — Qatar work week
  horizonDays: 14,               // how far ahead to search
  durationMin: 45,               // must stay < 60 (same-hour end)
  tzOffset: '+03:00'             // Qatar: no DST
};

const _hookRaw = $('Interview Request Hook').item.json;
const hook = _hookRaw.body || _hookRaw; // webhook v2 nests JSON under body
const candidateName = hook.name || hook.candidateName || hook.candidate_name || 'Candidate';
const email = hook.email || hook.candidateEmail || hook.candidate_email;
const role = hook.role || hook.roleTitle || hook.role_title || 'Interview';

if (!email) throw new Error('Missing candidate email. POST { name, email, role }.');

// ---- load already-booked slots from the schedule sheet ----
const booked = new Set();
try {
  const rows = $('Load Booked Slots').all();
  for (const r of rows) {
    const v = r.json && (r.json.slot_start || r.json.slotStart);
    if (v) booked.add(String(v));
  }
} catch (e) { /* sheet not ready yet — treat as empty */ }

// ---- build the next available offers (Asia/Qatar) ----
const now = new Date();
const offers = [];
for (let d = 1; d <= CONFIG.horizonDays && offers.length < 3; d++) {
  const day = new Date(now.getTime() + d * 86400000);
  if (!CONFIG.workDays.includes(day.getDay())) continue;
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const dd = String(day.getDate()).padStart(2, '0');
  const dateStr = \`\${y}-\${m}-\${dd}\`;
  for (const h of CONFIG.slotHours) {
    const start = \`\${dateStr}T\${String(h).padStart(2, '0')}:00:00\${CONFIG.tzOffset}\`;
    if (booked.has(start)) continue;
    offers.push({ start, hour: h, dateStr });
    if (offers.length >= 3) break;
  }
}

if (offers.length === 0) {
  return [{ json: {
    status: 'waitlist',
    candidate_name: candidateName,
    candidate_email: email,
    role,
    message: \`No interview slots available in the next \${CONFIG.horizonDays} days — candidate added to waitlist.\`
  }}];
}

// ---- book the first offer, keep the rest as alternates ----
const chosen = offers[0];
const slotEnd = \`\${chosen.dateStr}T\${String(chosen.hour).padStart(2, '0')}:\${String(CONFIG.durationMin).padStart(2, '0')}:00\${CONFIG.tzOffset}\`;
const weekday = new Date(chosen.start).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Qatar' });

return [{ json: {
  status: 'booked',
  candidate_name: candidateName,
  candidate_email: email,
  role,
  slot_start: chosen.start,
  slot_end: slotEnd,
  duration_min: CONFIG.durationMin,
  display: \`\${weekday}, \${String(chosen.hour).padStart(2, '0')}:00 — Doha time (GMT+3)\`,
  alternates: offers.slice(1).map(o => o.start),
  booked_at: new Date().toISOString()
}}];`,
    };

    @node({
        id: 'b2e1f0a1-0005-4b2c-9d3e-is0000000005',
        name: 'Build Booking Row',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [260, 300],
    })
    BuildBookingRow = {
        jsCode: `const pick = $json;
if (pick.status === 'waitlist') {
  return [{ json: {
    booked_at: new Date().toISOString(),
    candidate_name: pick.candidate_name,
    candidate_email: pick.candidate_email,
    role: pick.role,
    slot_start: '',
    slot_end: '',
    status: 'waitlist'
}}];
}
return [{ json: {
  booked_at: pick.booked_at,
  candidate_name: pick.candidate_name,
  candidate_email: pick.candidate_email,
  role: pick.role,
  slot_start: pick.slot_start,
  slot_end: pick.slot_end,
  status: 'confirmed'
}}];`,
    };

    @node({
        id: 'b2e1f0a1-0006-4b2c-9d3e-is0000000006',
        name: 'Book Slot',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [480, 300],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    BookSlot = {
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
            value: 'Interview_Schedule',
        },
        columns: {
            mappingMode: 'autoMapInputData',
        },
        options: {},
    };

    @node({
        id: 'b2e1f0a1-0007-4b2c-9d3e-is0000000007',
        name: 'Build Confirmation',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [700, 300],
    })
    BuildConfirmation = {
        jsCode: `const pick = $('Pick Interview Slot').item.json;

if (pick.status === 'waitlist') {
  return [{ json: {
    status: 'waitlist',
    candidate_name: pick.candidate_name,
    candidate_email: pick.candidate_email,
    role: pick.role,
    alternates: [],
    emailHtml: \`<p>Dear \${pick.candidate_name},</p><p>Thank you for your interest in the <b>\${pick.role}</b> position. All interview slots for the coming two weeks are fully booked — we have added you to our priority waitlist and will reach out as soon as a slot opens.</p><p>Best regards,<br>Recruitment Team</p>\`
}}];
}

// Google Calendar "add event" template link (floating local time)
const fmt = s => s.replace(/[-:]/g, '').replace(/\\+03:00/, '');
const gcalLink = \`https://calendar.google.com/calendar/render?action=TEMPLATE\`
  + \`&text=\${encodeURIComponent('Interview — ' + pick.role)}\`
  + \`&dates=\${fmt(pick.slot_start)}/\${fmt(pick.slot_end)}\`
  + \`&details=\${encodeURIComponent(\`Interview for \${pick.role}. Duration \${pick.duration_min} minutes. Doha time (GMT+3).\`)}\`
  + \`&location=\${encodeURIComponent('Online / Doha')}\`;

const emailHtml = \`
<p>Dear \${pick.candidate_name},</p>
<p>Great news — we would like to invite you to an interview for the <b>\${pick.role}</b> position.</p>
<p><b>When:</b> \${pick.display}<br><b>Duration:</b> \${pick.duration_min} minutes</p>
<p><a href="\${gcalLink}" style="display:inline-block;padding:10px 18px;background:#1a73e8;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;">Add to Google Calendar</a></p>
<p>If this time does not work for you, simply reply to this email and we will reschedule.</p>
<p>Best regards,<br>Recruitment Team</p>\`;

return [{ json: {
  status: 'booked',
  candidate_name: pick.candidate_name,
  candidate_email: pick.candidate_email,
  role: pick.role,
  slot_start: pick.slot_start,
  slot_end: pick.slot_end,
  display: pick.display,
  duration_min: pick.duration_min,
  alternates: pick.alternates,
  gcal_link: gcalLink,
  emailHtml
}}];`,
    };

    @node({
        id: 'b2e1f0a1-0008-4b2c-9d3e-is0000000008',
        webhookId: '4ffe2e3e-18f8-4885-bf01-db73caeb6f6e',
        name: 'Send Confirmation',
        type: 'n8n-nodes-base.gmail',
        version: 2.2,
        position: [920, 300],
        credentials: { gmailOAuth2: { id: 'qiWG3HHdsA8yi4uD', name: 'Gmail account' } },
        onError: 'continueRegularOutput',
    })
    SendConfirmation = {
        sendTo: "={{ ($('Interview Request Hook').item.json.body && $('Interview Request Hook').item.json.body.email) || $('Interview Request Hook').item.json.email }}",
        subject: "=Interview Invitation — {{ $('Pick Interview Slot').item.json.role }}",
        emailType: 'html',
        message: "={{ $('Build Confirmation').item.json.emailHtml }}",
        options: {},
    };

    @node({
        id: 'b2e1f0a1-0009-4b2c-9d3e-is0000000009',
        name: 'Return Booking Result',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [1140, 300],
    })
    ReturnBookingResult = {
        respondWith: 'json',
        responseBody:
            "={{ JSON.stringify(Object.assign({}, $('Build Confirmation').item.json, { email_sent: Boolean($('Send Confirmation').item.json && $('Send Confirmation').item.json.id) })) }}",
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.InterviewRequestHook.out(0).to(this.LoadBookedSlots.in(0));
        this.InterviewRequestHook.out(0).to(this.EnsureScheduleSheet.in(0));
        this.LoadBookedSlots.out(0).to(this.PickInterviewSlot.in(0));
        this.PickInterviewSlot.out(0).to(this.BuildBookingRow.in(0));
        this.BuildBookingRow.out(0).to(this.BookSlot.in(0));
        this.BookSlot.out(0).to(this.BuildConfirmation.in(0));
        this.BuildConfirmation.out(0).to(this.SendConfirmation.in(0));
        this.SendConfirmation.out(0).to(this.ReturnBookingResult.in(0));
    }
}
