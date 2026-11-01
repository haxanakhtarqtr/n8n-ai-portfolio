import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Restaurant AI Receptionist
// Nodes   : 5  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ChatWithRestaurantAi               chatTrigger
// RestaurantAiReceptionist           agent                      [AI]
// MistralModel                       lmChatMistralCloud         [creds] [ai_languageModel]
// CustomerMemory                     memoryBufferWindow         [ai_memory]
// SubmitOrderTool                    httpRequestTool            [onError→regular] [ai_tool]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ChatWithRestaurantAi
//    → RestaurantAiReceptionist
//
// AI CONNECTIONS
// RestaurantAiReceptionist.uses({ ai_languageModel: MistralModel, ai_memory: CustomerMemory, ai_tool: [SubmitOrderTool] })
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'WxWEIbyLKJud1Ktn',
    name: 'Restaurant AI Receptionist',
    active: true,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class RestaurantAiReceptionistWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'resto-chat-trigger',
        webhookId: 'resto-chat-trigger-01',
        name: 'Chat with Restaurant AI',
        type: '@n8n/n8n-nodes-langchain.chatTrigger',
        version: 1.4,
        position: [240, 300],
        notes: 'Public chat intake for customers. Feeds chatInput to the receptionist agent.',
    })
    ChatWithRestaurantAi = {
        public: true,
        mode: 'webhook',
        options: {},
    };

    @node({
        id: 'resto-receptionist-agent',
        name: 'Restaurant AI Receptionist',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [520, 300],
        notes: 'Greets customers, answers menu questions, guides selection. Calls submit_order ONLY when the customer confirms items AND provides an email.',
    })
    RestaurantAiReceptionist = {
        promptType: 'define',
        text: '={{ $json.chatInput }}',
        options: {
            systemMessage: `You are the friendly receptionist for Al Rayyan Grill, a restaurant in Doha, Qatar. You chat with customers on the restaurant website.

MENU (exact names and prices in QAR):
- Chicken Mandi: 28
- Beef Burger: 22
- Mixed Grill Platter: 45
- Fattoush Salad: 18
- Soft Drink: 8

YOUR JOB:
1. Greet customers warmly and answer questions about the menu and prices.
2. Help them pick items and quantities. Suggest pairings (e.g. Fattoush goes well with Mixed Grill).
3. If they want delivery or water, politely say those are not available yet.
4. Once the customer CONFIRMS their order AND gives you their email address, call the submit_order tool with the exact item names from the menu (spelling must match), quantities, and their email.

RULES:
- Never invent menu items or prices. Only the items listed above exist.
- Use the exact item names from the menu when submitting (e.g. "Chicken Mandi", not "mandi chicken").
- Prices are calculated by the kitchen system, not by you. Do not state a final total — say the invoice will confirm it.
- Keep replies short and warm, 1-3 sentences, like a real receptionist on chat.
- If a customer asks for something not on the menu, apologize and suggest the closest item from the menu.
- Do not call submit_order until items AND email are both confirmed. If the email is missing, ask for it first.`,
        },
    };

    @node({
        id: 'resto-mistral-model',
        name: 'Mistral Model',
        type: '@n8n/n8n-nodes-langchain.lmChatMistralCloud',
        version: 1,
        position: [400, 520],
        credentials: { mistralCloudApi: { id: 'fCLkBkCGQaMocIDv', name: 'Mistral Cloud account' } },
    })
    MistralModel = {
        model: 'ministral-3b-latest',
        options: {
            temperature: 0.4,
        },
    };

    @node({
        id: 'resto-customer-memory',
        name: 'Customer Memory',
        type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
        version: 1.4,
        position: [640, 520],
        notes: 'Remembers the conversation so repeat customers keep their context.',
    })
    CustomerMemory = {
        sessionIdType: 'customKey',
        sessionKey: "={{ $('Chat with Restaurant AI').item.json.sessionId }}",
        contextWindowLength: 10,
    };

    @node({
        id: 'resto-submit-order-tool',
        name: 'Submit Order Tool',
        type: 'n8n-nodes-base.httpRequestTool',
        version: 4.5,
        position: [880, 520],
        onError: 'continueRegularOutput',
        notes: 'Calls the Restaurant Order API (separate workflow). The kitchen system validates items against the menu and prices the order — the AI only passes what the customer said.',
    })
    SubmitOrderTool = {
        toolDescription:
            'Submit a confirmed restaurant order to the kitchen API. Call this ONLY after the customer has confirmed their items AND provided their email address. Pass the exact item names from the menu, the quantities, and the customer email address.',
        method: 'POST',
        url: 'http://localhost:5678/webhook/restaurant-order',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
            "={{ JSON.stringify({ items: $fromAI('order_items', 'The confirmed order items as a JSON array string, e.g. [\\\"{\\\\\\\"item\\\\\\\":\\\\\\\"Chicken Mandi\\\\\\\",\\\\\\\"qty\\\\\\\":2}\\\"] using exact menu item names', 'string'), customer_email: $fromAI('customer_email', 'The customer email address for the invoice', 'string') }) }}",
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ChatWithRestaurantAi.out(0).to(this.RestaurantAiReceptionist.in(0));

        this.RestaurantAiReceptionist.uses({
            ai_languageModel: this.MistralModel.output,
            ai_memory: this.CustomerMemory.output,
            ai_tool: [this.SubmitOrderTool.output],
        });
    }
}
