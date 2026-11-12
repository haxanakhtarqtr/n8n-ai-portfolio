import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Knowledge Base RAG Chatbot
// Nodes   : 15  |  Connections: 13
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// KbUploadForm                       formTrigger
// EnsureKbSheet                      googleSheets               [onError→regular] [creds] [retry]
// ExtractPdfText                     extractFromFile            [onError→regular] [alwaysOutput]
// ChunkDocument                      code
// EmbedChunk                         httpRequest                [retry]
// BuildChunkRow                      code
// StoreChunk                         googleSheets               [creds] [retry]
// KbQuestionHook                     webhook
// LoadKbChunks                       googleSheets               [onError→regular] [creds] [alwaysOutput] [retry]
// EmbedQuestion                      httpRequest                [retry]
// RetrieveTopChunks                  code
// GenerateAnswer                     httpRequest                [creds] [retry]
// BuildKbAnswer                      code
// ReturnKbAnswer                     respondToWebhook
// KbUploadApi                        webhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// KbUploadForm
//    → EnsureKbSheet
//    → ExtractPdfText
//      → ChunkDocument
//        → EmbedChunk
//          → BuildChunkRow
//            → StoreChunk
// KbQuestionHook
//    → LoadKbChunks
//      → EmbedQuestion
//        → RetrieveTopChunks
//          → GenerateAnswer
//            → BuildKbAnswer
//              → ReturnKbAnswer
// KbUploadApi
//    → ExtractPdfText (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'y8v3MjFyKZokFNuw',
    name: 'Knowledge Base RAG Chatbot',
    active: true,
    isArchived: false,
    projectId: 'WkdztVBhxnc914pU',
})
export class KnowledgeBaseRagChatbotWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'kb000001-0001-4b2c-9d3e-rag0000000001',
        webhookId: 'kb-upload-hook-01',
        name: 'KB Upload Form',
        type: 'n8n-nodes-base.formTrigger',
        version: 2.6,
        position: [-860, 420],
        notes: 'Ingest entry: title + text area and/or PDF. PDF wins when both are provided.',
    })
    KbUploadForm = {
        formFields: {
            values: [
                {
                    fieldLabel: 'Document Title',
                    requiredField: true,
                },
                {
                    fieldLabel: 'Document Type',
                    fieldType: 'text',
                    placeholder: 'e.g. HR Policy, Product Doc, FAQ',
                },
                {
                    fieldLabel: 'Document Text',
                    fieldType: 'textarea',
                    placeholder: 'Paste the document content here (if no PDF)...',
                },
                {
                    fieldLabel: 'Document PDF',
                    fieldType: 'file',
                    multipleFiles: false,
                    acceptFileTypes: '.pdf',
                },
            ],
        },
        options: {
            path: 'kb-upload',
        },
        formTitle: 'Knowledge Base Uploader',
        formDescription: 'Add a document to the RAG knowledge base. It will be chunked, embedded and indexed.',
    };

    @node({
        id: 'kb000001-0002-4b2c-9d3e-rag0000000002',
        name: 'Ensure KB Sheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-640, 600],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
        notes: 'Side branch only - keeps sheet-API noise out of the data path.',
    })
    EnsureKbSheet = {
        resource: 'sheet',
        operation: 'create',
        documentId: {
            __rl: true,
            value: '1rY0CWhc52JCjw39balR7ZuKpxPnensdA_WLNJ_y_MJM',
            mode: 'list',
            cachedResultName: 'Untitled spreadsheet',
        },
        title: 'KB_Chunks',
        options: {},
    };

    @node({
        id: 'kb000001-0003-4b2c-9d3e-rag0000000003',
        name: 'Extract PDF Text',
        type: 'n8n-nodes-base.extractFromFile',
        version: 1.1,
        position: [-640, 420],
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        notes: 'No PDF uploaded -> error tolerated, chunker falls back to the text area.',
    })
    ExtractPdfText = {
        operation: 'pdf',
        binaryPropertyName: 'Document PDF',
        options: {
            joinPages: true,
        },
    };

    @node({
        id: 'kb000001-0004-4b2c-9d3e-rag0000000004',
        name: 'Chunk Document',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-420, 420],
    })
    ChunkDocument = {
        jsCode: `// ============================================================
// DETERMINISTIC CHUNKER - fixed overlap window, sentence-aware
// Accepts: (a) form upload (text area / PDF), (b) API upload via
// KB Upload API webhook: POST { "title", "type", "text" }.
// Edit CONFIG to change chunk size / overlap.
// ============================================================
const CONFIG = { chunkSize: 900, overlap: 120, minChunk: 40 };

let form = null, api = null;
try { form = $('KB Upload Form').item.json; } catch (e) { /* form not in this execution path */ }
try { api = $('KB Upload API').item.json; } catch (e) { /* api not in this execution path */ }
const apiBody = (api && api.body) ? api.body : {};

let text = ($json && typeof $json.data === 'string' && $json.data.trim())
  ? $json.data
  : ((form && form['Document Text']) || apiBody.text || '');
text = String(text).replace(/\\\\r\\\\n/g, '\\n').trim();

if (!text || text.length < CONFIG.minChunk) {
  throw new Error('No document text found. Paste text in the form, upload a PDF, or POST { title, type, text } to /webhook/knowledge-base-upload.');
}

const chunks = [];
let start = 0;
while (start < text.length) {
  let end = Math.min(start + CONFIG.chunkSize, text.length);
  if (end < text.length) {
    const slice = text.slice(start, end);
    const brk = Math.max(slice.lastIndexOf('\\\\n\\\\n'), slice.lastIndexOf('\\\\n'), slice.lastIndexOf('. '));
    if (brk > CONFIG.chunkSize * 0.5) end = start + brk + 1;
  }
  const piece = text.slice(start, end).trim();
  if (piece.length >= CONFIG.minChunk) chunks.push(piece);
  if (end >= text.length) break;
  start = end - CONFIG.overlap;
}

const now = new Date().toISOString();
const title = (form && form['Document Title']) || apiBody.title || 'Untitled';
const docType = (form && form['Document Type']) || apiBody.type || 'general';
return chunks.map((chunk_text, i) => ({ json: {
  title, doc_type: docType, chunk_index: i, total_chunks: chunks.length,
  chunk_text, indexed_at: now
}}));`,
    };

    @node({
        id: 'kb000001-0005-4b2c-9d3e-rag0000000005',
        name: 'Embed Chunk',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-200, 420],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    EmbedChunk = {
        method: 'POST',
        url: 'http://host.docker.internal:11434/api/embeddings',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: "={{ JSON.stringify({ model: 'nomic-embed-text', prompt: $json.chunk_text }) }}",
        options: {
            timeout: 60000,
        },
    };

    @node({
        id: 'kb000001-0006-4b2c-9d3e-rag0000000006',
        name: 'Build Chunk Row',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [20, 420],
    })
    BuildChunkRow = {
        jsCode: `// one row per chunk — embeddings arrive in the same order as chunks
const chunks = $('Chunk Document').all();
const embs = $input.all();
if (chunks.length !== embs.length) throw new Error('Chunk/embedding count mismatch: ' + chunks.length + ' vs ' + embs.length);
return chunks.map((c, i) => {
  const emb = embs[i].json.embedding;
  if (!Array.isArray(emb)) throw new Error('Embedding missing on chunk ' + i);
  return { json: { ...c.json, embedding_json: JSON.stringify(emb) } };
});`,
    };

    @node({
        id: 'kb000001-0007-4b2c-9d3e-rag0000000007',
        name: 'Store Chunk',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [240, 420],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    StoreChunk = {
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
            value: 'KB_Chunks',
        },
        columns: {
            mappingMode: 'autoMapInputData',
        },
        options: {},
    };

    @node({
        id: 'kb000001-0008-4b2c-9d3e-rag0000000008',
        webhookId: 'kb-query-hook-01',
        name: 'KB Question Hook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-860, 40],
        notes: 'Query entry: POST { question }. Demo front-end and any client can ask.',
    })
    KbQuestionHook = {
        httpMethod: 'POST',
        path: 'knowledge-base',
        responseMode: 'responseNode',
        authentication: 'none',
        options: {
            allowedOrigins: '*',
        },
    };

    @node({
        id: 'kb000001-0009-4b2c-9d3e-rag0000000009',
        name: 'Load KB Chunks',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [-640, 40],
        credentials: { googleSheetsOAuth2Api: { id: '24dHedceL8i5PJLH', name: 'Google Sheets account' } },
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    LoadKbChunks = {
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
            value: 'KB_Chunks',
        },
        options: {},
    };

    @node({
        id: 'kb000001-0010-4b2c-9d3e-rag0000000010',
        name: 'Embed Question',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-420, 40],
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    EmbedQuestion = {
        method: 'POST',
        url: 'http://host.docker.internal:11434/api/embeddings',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ model: 'nomic-embed-text', prompt: ($('KB Question Hook').item.json.body && $('KB Question Hook').item.json.body.question) || $('KB Question Hook').item.json.question || '' }) }}",
        options: {
            timeout: 60000,
        },
    };

    @node({
        id: 'kb000001-0011-4b2c-9d3e-rag0000000011',
        name: 'Retrieve Top Chunks',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-200, 40],
    })
    RetrieveTopChunks = {
        jsCode: `// ============================================================
// VECTOR SEARCH FROM SCRATCH — cosine similarity in auditable code
// No black-box vector DB: every match score is reproducible.
// ============================================================
const CONFIG = { topK: 4, minScore: 0.3 };

const hook = $('KB Question Hook').item.json;
const question = (hook.body && hook.body.question) || hook.question;
if (!question) throw new Error('Missing question. POST { "question": "..." }');

const q = $json.embedding;
if (!Array.isArray(q)) throw new Error('Question embedding failed');

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const norm = a => Math.sqrt(dot(a, a));
const nq = norm(q);

const scored = [];
try {
  const rows = $('Load KB Chunks').all();
  for (const r of rows) {
    const j = r.json || {};
    if (!j.embedding_json) continue;
    let emb;
    try { emb = JSON.parse(j.embedding_json); } catch (e) { continue; }
    if (!Array.isArray(emb) || emb.length !== q.length) continue;
    const d = nq * norm(emb);
    const score = d ? Math.round((dot(q, emb) / d) * 1000) / 1000 : 0;
    scored.push({ title: j.title || 'Untitled', doc_type: j.doc_type || 'general',
      chunk_index: Number(j.chunk_index) || 0, chunk_text: j.chunk_text || '', score });
  }
} catch (e) { /* KB empty or sheet missing */ }

scored.sort((a, b) => b.score - a.score);
const top = scored.filter(s => s.score >= CONFIG.minScore).slice(0, CONFIG.topK);
const ctxBlocks = top.map((c, i) => '[' + (i + 1) + '] (source: ' + c.title + ')\\n' + c.chunk_text).join('\\n\\n---\\n\\n');

return [{ json: {
  question,
  chunks_searched: scored.length,
  matches_found: top.length,
  top_score: top.length ? top[0].score : 0,
  contexts: top,
  user_prompt: 'QUESTION:\\n' + question + '\\n\\nKNOWLEDGE BASE CONTEXT:\\n' + (ctxBlocks || '(no relevant chunks found)')
}}];`,
    };

    @node({
        id: 'kb000001-0012-4b2c-9d3e-rag0000000012',
        name: 'Generate Answer',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [20, 40],
        credentials: { groqApi: { id: '6VUycnVaIxEH5YXv', name: 'Groq account' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    GenerateAnswer = {
        method: 'POST',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'groqApi',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ model: 'openai/gpt-oss-120b', temperature: 0.2, max_tokens: 800, messages: [ { role: 'system', content: 'You are a precise knowledge-base assistant. Answer ONLY using the provided KNOWLEDGE BASE CONTEXT. If the context does not contain the answer, reply exactly: This is not covered in the knowledge base yet. Cite sources inline using [1], [2] style. Be concise and factual.' }, { role: 'user', content: $json.user_prompt } ] }) }}",
        options: {
            timeout: 90000,
        },
    };

    @node({
        id: 'kb000001-0013-4b2c-9d3e-rag0000000013',
        name: 'Build KB Answer',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [240, 40],
    })
    BuildKbAnswer = {
        jsCode: `const q = $('Retrieve Top Chunks').item.json;
let answer = '';
try { answer = String($json.choices[0].message.content).trim(); } catch (e) {}
if (!answer) answer = 'Answer generation failed - please try again.';

return [{ json: {
  status: q.matches_found > 0 ? 'answered' : 'no_match',
  question: q.question,
  answer,
  sources: q.contexts.map(c => ({ title: c.title, similarity: c.score })),
  chunks_searched: q.chunks_searched,
  pipeline: {
    embeddings: 'ollama/nomic-embed-text (768-dim)',
    retrieval: 'cosine similarity in deterministic code',
    llm: 'groq/openai-gpt-oss-120b (temp 0.2, grounded)'
  }
}}];`,
    };

    @node({
        id: 'kb000001-0014-4b2c-9d3e-rag0000000014',
        name: 'Return KB Answer',
        type: 'n8n-nodes-base.respondToWebhook',
        version: 1.1,
        position: [460, 40],
    })
    ReturnKbAnswer = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify($json) }}',
    };

    @node({
        id: 'kb000001-0015-4b2c-9d3e-rag0000000015',
        webhookId: 'kb-upload-api-hook-01',
        name: 'KB Upload API',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-1080, 420],
        notes: 'Programmatic ingest: POST { title, type, text }. Bypasses the browser-form quirk; response is the stored chunk rows.',
    })
    KbUploadApi = {
        httpMethod: 'POST',
        path: 'knowledge-base-upload',
        responseMode: 'lastNode',
        authentication: 'none',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.KbUploadForm.out(0).to(this.EnsureKbSheet.in(0));
        this.KbUploadForm.out(0).to(this.ExtractPdfText.in(0));
        this.ExtractPdfText.out(0).to(this.ChunkDocument.in(0));
        this.ChunkDocument.out(0).to(this.EmbedChunk.in(0));
        this.EmbedChunk.out(0).to(this.BuildChunkRow.in(0));
        this.BuildChunkRow.out(0).to(this.StoreChunk.in(0));
        this.KbQuestionHook.out(0).to(this.LoadKbChunks.in(0));
        this.LoadKbChunks.out(0).to(this.EmbedQuestion.in(0));
        this.EmbedQuestion.out(0).to(this.RetrieveTopChunks.in(0));
        this.RetrieveTopChunks.out(0).to(this.GenerateAnswer.in(0));
        this.GenerateAnswer.out(0).to(this.BuildKbAnswer.in(0));
        this.BuildKbAnswer.out(0).to(this.ReturnKbAnswer.in(0));
        this.KbUploadApi.out(0).to(this.ExtractPdfText.in(0));
    }
}
