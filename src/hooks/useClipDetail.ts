"use client";

import { useEffect, useState } from "react";
import { getCachedClipDetail, loadClipDetail } from "@/lib/clip-detail-client";
import type { Clip } from "@/lib/types";

export type ClipDetailLoadState = "idle" | "loading" | "ready" | "error";

export function useClipDetail(clipId: string | null) {
  const [clip, setClip] = useState<Clip | null>(() =>
    clipId ? getCachedClipDetail(clipId) : null
  );
  const [loadState, setLoadState] = useState<ClipDetailLoadState>(() =>
    clipId ? (getCachedClipDetail(clipId) ? "ready" : "loading") : "idle"
  );

  useEffect(() => {
    if (!clipId) {
      setClip(null);
      setLoadState("idle");
      return;
    }

    const cached = getCachedClipDetail(clipId);
    if (cached) {
      setClip(cached);
      setLoadState("ready");
      return;
    }

    let cancelled = false;
    setLoadState("loading");

    loadClipDetail(clipId).then((nextClip) => {
      if (cancelled) {
        return;
      }

      if (!nextClip) {
        setClip(null);
        setLoadState("error");
        return;
      }

      setClip(nextClip);
      setLoadState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [clipId]);

  return {
    clip,
    loadState,
  };
}
