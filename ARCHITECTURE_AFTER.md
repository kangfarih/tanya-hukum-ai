# Architecture After Refactoring

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                            │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │        useChatRedux (Redux-integrated Hook)         │    │
│  │  - Manages message sending                           │    │
│  │  - Dispatches Redux actions                          │    │
│  │  - Handles SSE/WebSocket streaming                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                    │
│                          ├─→ Redux Store                      │
│                          │   ├─→ chat.messages               │
│                          │   ├─→ chat.isLoading              │
│                          │   ├─→ chat.error                  │
│                          │   └─→ session.isConnected         │
│                          │                                    │
│                          └─→ useSelector (anywhere)          │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ POST /api/chat
                                │ JSON: { messages: [...] }
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Backend                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │          route.ts (API Endpoint)                    │    │
│  │  - Validates JSON payload                           │    │
│  │  - Limits history to 20 messages                     │    │
│  │  - Calls streamChat()                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                    │
│                          ▼                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │      llm.ts (Provider Abstraction)                  │    │
│  │  - LLM_PROVIDER env var selects provider            │    │
│  │  - Supports: openrouter, gemini, deepseek          │    │
│  │  - Multi-key Gemini fallover                        │    │
│  │  - Handles API errors & rate limits                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                    │
│         ┌────────────────┼────────────────┐                  │
│         ▼                ▼                ▼                   │
│    OpenRouter         Gemini          DeepSeek               │
│   (Primary)          (With keys)      (Fallback)             │
│                                                               │
│                  ↓ (Streams tokens)                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         SSE Response (text/event-stream)            │    │
│  │  data: {"type":"token","delta":"..."}               │    │
│  │  data: {"type":"token","delta":"..."}               │    │
│  │  data: {"type":"done","text":"...","model":"..."}   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                                │
                                └─→ Back to Frontend
                                    Updates Redux
                                    Re-renders component
```

## Redux State Tree

```typescript
Store {
  chat: {
    messages: [
      { role: "user", content: "...", timestamp: 123456 },
      { role: "assistant", content: "...", timestamp: 123457 }
    ],
    isLoading: false,
    error: null,
    currentModel: "openrouter:openai/gpt-4o-mini"
  },
  session: {
    sessionId: "session-123456789",
    isConnected: false,
    connectionError: null
  }
}
```

## Component Access Patterns

### Pattern 1: Using the Hook
```typescript
import { useChatRedux } from "hooks/useChatRedux";

export function ChatComponent() {
  const { messages, sendMessage, isLoading, error } = useChatRedux();
  return (
    <>
      {messages.map(msg => <Message key={...} {...msg} />)}
      <Input onSend={sendMessage} disabled={isLoading} />
      {error && <Error>{error}</Error>}
    </>
  );
}
```

### Pattern 2: Direct Redux Selectors
```typescript
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "src/lib/redux/store";

export function ChatStatus() {
  const isLoading = useSelector(state => state.chat.isLoading);
  const model = useSelector(state => state.chat.currentModel);
  const isConnected = useSelector(state => state.session.isConnected);
  
  return (
    <div>
      Status: {isLoading ? "Loading" : "Ready"}
      Model: {model}
      Connection: {isConnected ? "Connected" : "Disconnected"}
    </div>
  );
}
```

## Provider Configuration

### Environment Variables
```bash
# Select provider (default: openrouter)
LLM_PROVIDER=gemini

# Provide API keys
GEMINI_API_KEY=abc123...
GEMINI_API_KEYS=key1,key2,key3    # Multi-key fallover

# Override model (optional)
GEMINI_MODEL=gemini-2.5-flash
```

### At Runtime
```typescript
// In llm.ts:
// 1. Read LLM_PROVIDER env var
// 2. Load corresponding API key(s)
// 3. For Gemini: try each key until one works
// 4. For others: use single key
// 5. If all fail: throw error (caught by route.ts)
```

## Error Handling Flow

```
Browser sends message
      ↓
route.ts validates JSON
      ├─→ Invalid → Return 400
      ↓
llm.ts attempts streamChat()
      ├─→ Auth error → Error
      ├─→ Rate limit → Error  
      ├─→ Success → Stream tokens
      ├─→ Abort signal → Stop streaming
      ↓
Send SSE events
      ├─→ {"type":"token","delta":"..."}
      ├─→ {"type":"token","delta":"..."}
      └─→ {"type":"done"} or {"type":"error"}
      ↓
Frontend receives events
      ├─→ Parse SSE
      ├─→ Dispatch Redux actions
      ├─→ Re-render component
      ↓
User sees response (or error)
```

## Future: WebSocket Support

```
When enabled (useWebSocket = true):

Browser
  ├─→ ChatWebSocket.connect(sessionId)
  │   └─→ WebSocket://.../api/ws
  │
  ├─→ Send: {"type":"message","sessionId":"..."}
  │   └─→ Server broadcasts tokens
  │
  └─→ Receive: {"type":"token","delta":"..."}
      └─→ Redux dispatch + re-render
```

## Data Flow: Single Message

```
1. User types "Hello" → clicks send

2. useChatRedux.sendMessage("Hello")
   - Dispatches addUserMessage("Hello")
   - Dispatches addAssistantMessage()
   - Dispatches setLoading(true)

3. Redux state updated:
   - chat.messages = [..., user msg, empty assistant msg]
   - chat.isLoading = true

4. Component re-renders (shows new messages)

5. Fetch POST /api/chat with:
   {"messages": [
     {"role": "user", "content": "Hello"}
   ]}

6. route.ts receives, validates, calls streamChat()

7. llm.ts queries LLM provider via OpenAI SDK

8. Provider streams tokens back via SSE

9. Frontend parses SSE events:
   data: {"type":"token","delta":"H"}
   data: {"type":"token","delta":"e"}
   data: {"type":"token","delta":"llo"}
   ...

10. For each token:
    - Dispatches appendTokenToLastMessage("H")
    - Redux updates state.chat.messages[1].content = "H"
    - Component re-renders (incremental update)

11. When done:
    - Dispatches setLoading(false)
    - Dispatches setCurrentModel("openrouter:...")
    - Component shows full response
```

## File Dependencies

```
hooks/useChatRedux.ts
  ├─→ src/lib/redux/store.ts
  │   ├─→ src/lib/redux/slices/chatSlice.ts
  │   └─→ src/lib/redux/slices/sessionSlice.ts
  ├─→ src/lib/websocket.ts (optional)
  └─→ /api/chat (fetch)

src/app/layout.tsx
  └─→ src/components/ReduxProvider.tsx
      └─→ src/lib/redux/store.ts

src/app/api/chat/route.ts
  └─→ src/lib/llm.ts
      └─→ OpenAI SDK (installed)

Any component
  └─→ useSelector (accesses Redux)
  └─→ useChatRedux (sends messages)
```

## Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI** | React hooks | Display messages, input |
| **State** | Redux Toolkit | Centralized state (messages, loading, error) |
| **Communication** | SSE/WebSocket | Real-time streaming |
| **Backend** | Next.js Route | Validate, stream from LLM |
| **LLM** | OpenAI SDK | Talk to providers (OpenRouter/Gemini/DeepSeek) |
| **Provider** | HTTP/API | Execute AI queries |

---

**Simplicity**: ✅ Single source of truth (llm.ts)  
**Scalability**: ✅ Redux for complex state  
**Real-time**: ✅ SSE now, WebSocket ready  
**Testability**: ✅ Reduced coupling  
