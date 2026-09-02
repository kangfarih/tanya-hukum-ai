"use client";

import { ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@/main/store/store";
import { LanguageProvider } from "@/main/i18n/LanguageContext";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <Provider store={store}>
      <LanguageProvider>{children}</LanguageProvider>
    </Provider>
  );
}
