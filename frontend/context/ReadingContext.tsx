"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { shouldShowFurigana } from "@/lib/reading";

type ReadingContextValue = {
  showFurigana: boolean;
  grade: number;
};

const ReadingContext = createContext<ReadingContextValue | null>(null);

export function ReadingProvider({ grade, children }: { grade: number; children: ReactNode }) {
  const value = useMemo(
    () => ({ grade, showFurigana: shouldShowFurigana(grade) }),
    [grade],
  );
  return <ReadingContext.Provider value={value}>{children}</ReadingContext.Provider>;
}

export function useReading() {
  const ctx = useContext(ReadingContext);
  return ctx ?? { showFurigana: false, grade: 7 };
}
