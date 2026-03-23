"use client";

import { useEffect, useState } from "react";
import { useClipStore } from "@/stores/clipStore";
import { RightPanelInspector } from "./RightPanelInspector";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Clip, Locale } from "@/lib/types";

interface RightPanelContentProps {
  categories: CategoryTree;
  lang: Locale;
  dict: Dictionary;
}

export function RightPanelContent({
  categories,
  lang,
  dict,
}: RightPanelContentProps) {
  const { selectedClipId } = useClipStore();
  const [clip, setClip] = useState<Clip | null>(null);
  const activeClip = clip?.id === selectedClipId ? clip : null;

  useEffect(() => {
    if (!selectedClipId) {
      return;
    }
    const controller = new AbortController();
    fetch(`/data/clips/${selectedClipId}.json`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setClip)
      .catch((e) => {
        if (e.name !== "AbortError") setClip(null);
      });
    return () => controller.abort();
  }, [selectedClipId]);

  if (!activeClip) {
    return null;
  }

  return (
    <RightPanelInspector
      clip={activeClip}
      categories={categories}
      lang={lang}
      dict={dict}
    />
  );
}
