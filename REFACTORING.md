# TanyaHukum Architecture Refactoring

## Overview
This refactoring consolidates the chat architecture, removes dead code, and prepares the system for WebSocket support and centralized state management via Redux.

## Changes Made

### 1. ✅ Removed Dead Code
- **Deleted**: `EXTRA_PROVIDER_MODELS` from `app/src/app/api/chat/route.ts`
- **Reason**: Redundant provider failover logic; consolidated into single `llm.ts` abstraction
- **Benefit**: Cleaner codebase, single source of truth for provider configuration

### 2. ✅ Consolidated Provider Logic
- **Before**: Two parallel systems
  - `route.ts`: Hard-coded OpenRouter → Gemini → DeepSeek fallback
  - `llm.ts`: Environment-driven provider selection
- **After**: Single source via `llm.ts`
  - `LLM_PROVIDER` env var selects provider
  - `llm.ts` handles multi-key Gemini fallover
  - `route.ts` is thin wrapper calling `streamChat()`

### 3. ✅ Added Redux State Management
**New Files:**
- `src/lib/redux/store.ts` - Redux store configuration
- `src/lib/redux/slices/chatSlice.ts` - Chat state (messages, loading, error)
- `src/lib/redux/slices/sessionSlice.ts` - Session state (WebSocket connection)
- `src/components/ReduxProvider.tsx` - App-level provider wrapper

**State Structure:**
```typescript
{
  chat: {
    messages: ChatMessage[],
    isLoading: boolean,
    error: string | null,
    currentModel: string
  },
  session: {
    sessionId: string | null,
    isConnected: boolean,
    connectionError: string | null
  }
}
```

### 4. ✅ Added WebSocket Infrastructure
**New Files:**
- `src/lib/websocket.ts` - `ChatWebSocket` class with reconnection, queuing, and event handling
- `next.ws.config.ts` - WebSocket server setup placeholder
- `hooks/useChatRedux.ts` - New Redux-integrated chat hook

**WebSocket Features:**
- Auto-reconnection with exponential backoff
- Message queuing during connection
- Type-safe message protocol
- Session ID tracking

### 5. ✅ Updated App Layout
- `src/app/layout.tsx` now wraps children with `<ReduxProvider>`
- Enables Redux hooks throughout the app

### 6. ✅ Created New Chat Hook
**`hooks/useChatRedux.ts`** replaces `hooks/useChat.ts`
- Dispatches Redux actions instead of local setState
- Integrates WebSocket client (optional, currently REST)
- Cleaner separation of concerns
- Better testing and debugging

## Configuration

### Environment Variables
```bash
# Provider selection (default: openrouter)
LLM_PROVIDER=openrouter|gemini|deepseek

# Provider-specific keys
OPENROUTER_API_KEY=your-key
GEMINI_API_KEY=your-key
GEMINI_API_KEYS=key1,key2,key3  # Multi-key fallover for Gemini
DEEPSEEK_API_KEY=your-key

# Model selection (optional, uses provider defaults)
OPENROUTER_MODEL=openai/gpt-4o-mini
GEMINI_MODEL=gemini-2.5-flash
DEEPSEEK_MODEL=deepseek-chat
```

## Migration Guide

### For Existing Component Code

**Before (old useChat):**
```typescript
import { useChat } from "../../hooks/useChat";

export function ChatComponent() {
  const { messages, sendMessage, isLoading, error } = useChat();
  // ... component code
}
```

**After (new useChatRedux):**
```typescript
import { useChatRedux } from "../../hooks/useChatRedux";

export function ChatComponent() {
  const { messages, sendMessage, isLoading, error, currentModel } = useChatRedux();
  // ... component code
}
```

### For State Access Anywhere in App
```typescript
import { useSelector } from "react-redux";
import type { RootState } from "../lib/redux/store";

export function ChatStatus() {
  const messages = useSelector((state: RootState) => state.chat.messages);
  const isConnected = useSelector((state: RootState) => state.session.isConnected);
  // ...
}
```

## Next Steps (Optional)

### 1. Implement Full WebSocket Server
- Set up custom Node.js server with `ws` library
- Add session persistence
- Replace SSE with WebSocket streaming

```bash
# Already installed:
npm install ws @types/ws --save-dev
```

### 2. Add Chat Persistence
- Replace localStorage with IndexedDB (persistent, larger quota)
- Add server-side chat history
- Implement chat sync across devices

### 3. Integrate RAG/Retrieval
- Wire corpus embedding pipeline
- Add retrieval context to system prompt
- Validate citations against corpus

### 4. Enhanced Error Handling
- Circuit breaker pattern for provider failures
- Structured error logging
- User-friendly error messages with recovery options

### 5. Performance Optimization
- Memoize Redux selectors with Reselect
- Add Redux DevTools for debugging
- Implement request deduplication

## Breaking Changes

None. The old `useChat` hook is still available for backward compatibility.

**However**, to use Redux features:
- Replace imports: `useChat` → `useChatRedux`
- Wrap app layout with `<ReduxProvider>` (✅ already done)

## Testing Checklist

- [ ] App builds without errors: `npm run build`
- [ ] Dev server starts: `npm run dev`
- [ ] Chat sends messages via REST API
- [ ] Messages appear in Redux state
- [ ] Error handling works (bad API key, network failure)
- [ ] Stop/cancel button stops streaming
- [ ] Chat history persists (localStorage)
- [ ] WebSocket client connects (when enabled)

## File Structure
```
app/
├── src/
│   ├── app/
│   │   ├── api/chat/route.ts (refactored - now thin)
│   │   └── layout.tsx (updated - includes ReduxProvider)
│   ├── components/
│   │   └── ReduxProvider.tsx (new)
│   └── lib/
│       ├── redux/
│       │   ├── store.ts (new)
│       │   └── slices/
│       │       ├── chatSlice.ts (new)
│       │       └── sessionSlice.ts (new)
│       ├── llm.ts (unchanged - now the source of truth)
│       └── websocket.ts (new - ready for WS server)
└── hooks/
    ├── useChat.ts (old - still works)
    └── useChatRedux.ts (new - recommended)
```

## Dependencies Added
- `@reduxjs/toolkit` - Redux state management
- `react-redux` - React bindings
- `ws` (dev) - WebSocket server support

## Backward Compatibility

✅ **Old `useChat` hook still works**
✅ **Existing REST API (`/api/chat`) unchanged**
❌ **App layout now requires `<ReduxProvider>` (already applied)**

---

**Version**: 1.0.0  
**Date**: 2026-09-02  
**Status**: Ready for testing
