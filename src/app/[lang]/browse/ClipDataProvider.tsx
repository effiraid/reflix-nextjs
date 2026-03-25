"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ClipIndex } from "@/lib/types";

const ClipDataContext = createContext<ClipIndex[]>([]);

export function ClipDataProvider({
  clips,
  children,
}: {
  clips: ClipIndex[];
  children: ReactNode;
}) {
  return (
    <ClipDataContext.Provider value={clips}>{children}</ClipDataContext.Provider>
  );
}

export function useClipData() {
  return useContext(ClipDataContext);
}
