import { configureStore } from "@reduxjs/toolkit";
import sessionReducer from "./slices/sessionSlice";

export const store = configureStore({
  reducer: {
    sessions: sessionReducer,
  },
});

// Persist to localStorage on state changes
store.subscribe(() => {
  if (typeof window !== "undefined") {
    try {
      const state = store.getState();
      // Only save sessions, not activeSessionId (it's ephemeral)
      const toSave = {
        sessions: state.sessions.sessions,
      };
      localStorage.setItem("tanyahukum.sessions.v1", JSON.stringify(toSave));
    } catch (error) {
      console.error("Failed to persist session state:", error);
    }
  }
});

// Load initial state from localStorage after store is created
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("tanyahukum.sessions.v1");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.sessions && Object.keys(parsed.sessions).length > 0) {
        store.dispatch({ type: "sessions/hydrateSessions", payload: parsed.sessions });
      }
    }
  } catch (error) {
    console.error("Failed to load session state from localStorage:", error);
  }
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;