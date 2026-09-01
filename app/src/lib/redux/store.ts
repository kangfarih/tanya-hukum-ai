import { configureStore } from "@reduxjs/toolkit";
import sessionReducer from "./slices/sessionSlice";

export const store = configureStore({
  reducer: {
    sessions: sessionReducer,
  },
});

// Load initial state from localStorage after store is created
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("tanyahukum.sessions.v1");
    if (stored) {
      const parsed = JSON.parse(stored);
      store.dispatch({ type: "sessions/hydrateSessions", payload: parsed });
    }
  } catch (error) {
    console.error("Failed to load session state from localStorage:", error);
  }
}

// Persist to localStorage on state changes
store.subscribe(() => {
  if (typeof window !== "undefined") {
    try {
      const state = store.getState();
      localStorage.setItem("tanyahukum.sessions.v1", JSON.stringify(state.sessions));
    } catch (error) {
      console.error("Failed to persist session state:", error);
    }
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;