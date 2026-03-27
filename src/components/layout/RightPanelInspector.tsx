"use client";

import { useState } from "react";
import Image from "next/image";
import { InspectorSidebarSections } from "@/components/clip/InspectorSidebarSections";
import { getClipMediaKind } from "@/lib/clipInspector";
import { getMediaUrl } from "@/lib/mediaUrl";
import { useUIStore } from "@/stores/uiStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { BrowseClipRecord, CategoryTree, Clip, Locale } from "@/lib/types";

interface RightPanelInspectorProps {
  clip: Clip;
  categories: CategoryTree;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
  tagI18n?: Record<string, string>;
  relatedClips?: BrowseClipRecord[];
  onSelectFolder?: (folderId: string) => void;
  onSelectRelatedClip?: (clipId: string) => void;
  onSelectTag?: (tag: string) => void;
}

export function RightPanelInspector({
  clip,
  categories,
  lang,
  dict,
  tagI18n = {},
  relatedClips = [],
  onSelectFolder,
  onSelectRelatedClip,
  onSelectTag,
}: RightPanelInspectorProps) {
  const title = clip.i18n.title[lang] || clip.name;
  const thumbnailUrl = getMediaUrl(clip.thumbnailUrl);
  const previewUrl = getMediaUrl(clip.previewUrl);
  const quickViewOpen = useUIStore((state) => state.quickViewOpen);
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const previewFailed = quickViewOpen || failedPreviewUrl === previewUrl;
  const mediaKindKey = getClipMediaKind(clip.ext);
  const mediaKind =
    mediaKindKey === "video" ? dict.clip.video : dict.clip.image;

  return (
    <div className="space-y-5 p-4 text-sm text-foreground">
      <div className="relative h-48 overflow-hidden rounded-2xl border border-border bg-surface/60">
        <div className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
          {mediaKind}
        </div>
        {mediaKindKey === "video" && !previewFailed ? (
          <video
            src={previewUrl}
            poster={thumbnailUrl}
            muted
            loop
            playsInline
            autoPlay
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
            className="h-full w-full object-cover"
            onError={() => setFailedPreviewUrl(previewUrl)}
          />
        ) : (
          <Image
            src={thumbnailUrl}
            alt={title}
            width={clip.width}
            height={clip.height}
            loading="eager"
            fetchPriority="high"
            sizes="320px"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <InspectorSidebarSections
        clip={clip}
        categories={categories}
        lang={lang}
        dict={dict}
        tagI18n={tagI18n}
        relatedClips={relatedClips}
        onSelectFolder={onSelectFolder}
        onSelectRelatedClip={onSelectRelatedClip}
        onSelectTag={onSelectTag}
      />
    </div>
  );
}
