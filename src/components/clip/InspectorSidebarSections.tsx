"use client";

import { useState } from "react";
import Image from "next/image";
import { ShareButton } from "@/components/clip/ShareButton";
import { getStructuredAiTags } from "@/lib/aiTags";
import { getCategoryLabel } from "@/lib/categories";
import { formatClipDuration, getClipMediaKind } from "@/lib/clipInspector";
import { getMediaUrl } from "@/lib/mediaUrl";
import { getTagDisplayLabels } from "@/lib/tagDisplay";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { BrowseClipRecord, CategoryTree, Clip, Locale } from "@/lib/types";

interface InspectorSidebarSectionsProps {
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

export function InspectorSidebarSections({
  clip,
  categories,
  lang,
  dict,
  tagI18n = {},
  relatedClips = [],
  onSelectFolder,
  onSelectRelatedClip,
  onSelectTag,
}: InspectorSidebarSectionsProps) {
  const [aiExpanded, setAiExpanded] = useState(false);
  const mediaKindKey = getClipMediaKind(clip.ext);
  const mediaKind =
    mediaKindKey === "video" ? dict.clip.video : dict.clip.image;
  const aiAnalysisLabel =
    dict.clip.aiAnalysis ?? (lang === "ko" ? "AI 분석" : "AI Analysis");
  const aiLatestLabel = dict.clip.aiLatest ?? "NEW";
  const aiPendingLabel =
    dict.clip.aiPending ??
    (lang === "ko" ? "AI 분석 대기 중" : "AI analysis pending");
  const folderItems = clip.folders.map((folderId) => ({
    id: folderId,
    label: getCategoryLabel(folderId, categories, lang),
  }));
  const tagLabels = getTagDisplayLabels(clip.tags, lang, tagI18n);
  const tagItems = clip.tags.map((tag, index) => ({
    id: tag,
    label: tagLabels[index] ?? tag,
  }));
  const palette = clip.palettes?.slice(0, 6) ?? [];
  const linkText = clip.url || dict.clip.noLink;
  const memoText = clip.annotation || "-";
  const hasLink = Boolean(clip.url);
  const hasMemo = Boolean(clip.annotation);
  const hasAiAnalysis = Object.prototype.hasOwnProperty.call(clip, "aiTags");
  const aiTagTokens = getTagDisplayLabels(
    getStructuredAiTags(clip.aiTags),
    lang,
    tagI18n
  );

  return (
    <>
      {hasAiAnalysis ? (
        <section
          aria-label={aiAnalysisLabel}
          className="relative overflow-hidden rounded-2xl border border-accent/35 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.16),transparent_42%),linear-gradient(180deg,rgba(96,165,250,0.14),rgba(255,255,255,0.04))] shadow-[0_8px_24px_rgba(37,99,235,0.14)]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(96,165,250,0.9),transparent)]"
          />
          <button
            type="button"
            aria-expanded={aiExpanded}
            aria-label={aiAnalysisLabel}
            onClick={() => setAiExpanded((open) => !open)}
            className="relative flex min-h-12 w-full items-center justify-between gap-3 px-4 py-4 text-left"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex size-6 items-center justify-center rounded-full border border-accent/25 bg-accent/20 text-xs text-white shadow-[0_0_0_4px_rgba(96,165,250,0.08)]"
              >
                ✦
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/90">
                {aiAnalysisLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-accent/25 bg-[linear-gradient(180deg,rgba(96,165,250,0.3),rgba(59,130,246,0.18))] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white">
                {aiLatestLabel}
              </span>
              <ChevronToggle expanded={aiExpanded} />
            </div>
          </button>

          {aiExpanded ? (
            <div className="space-y-3 px-4 pb-4">
              {clip.aiTags === null ? (
                <p className="text-xs italic text-muted">{aiPendingLabel}</p>
              ) : clip.aiTags ? (
                <>
                  <p className="text-xs leading-relaxed text-muted">
                    {clip.aiTags.description[lang] || clip.aiTags.description.ko}
                  </p>
                  {aiTagTokens.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {aiTagTokens.map((item) => (
                        <span
                          key={item}
                          className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-foreground"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <TokenSection
        label={dict.clip.folders}
        items={folderItems}
        onSelectItem={onSelectFolder}
      />

      <TokenSection
        label={dict.clip.tags}
        items={tagItems}
        onSelectItem={onSelectTag}
      />

      {palette.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface/40 p-3">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
            {dict.clip.colorPalette}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {palette.map((swatch, index) => (
              <div
                key={`${swatch.color.join("-")}-${index}`}
                className="h-8 w-8 rounded-full border border-white/10 shadow-sm"
                style={{
                  backgroundColor: `rgb(${swatch.color[0]}, ${swatch.color[1]}, ${swatch.color[2]})`,
                }}
                title={`${swatch.ratio}%`}
              />
            ))}
          </div>
        </div>
      ) : null}

      <FieldCard label={dict.clip.memo} value={memoText} isPlaceholder={!hasMemo} />

      <FieldCard
        label={dict.clip.sourceUrl}
        value={linkText}
        mono={hasLink}
        isPlaceholder={!hasLink}
      />

      <section className="rounded-2xl border border-border bg-surface/40 p-4">
        <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
          {dict.clip.properties}
        </h4>
        <dl className="space-y-3">
          <PropertyRow
            label={dict.clip.inspectorRating}
            value={`${"★".repeat(clip.star)}${"☆".repeat(Math.max(0, 5 - clip.star))}`}
          />
          <PropertyRow
            label={dict.clip.inspectorDuration}
            value={formatClipDuration(clip.duration)}
          />
          <PropertyRow label={dict.clip.fileType} value={mediaKind} />
        </dl>
      </section>

      {relatedClips.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface/40 p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
            {dict.clip.related}
          </h4>
          <div
            role="list"
            aria-label={dict.clip.related}
            className="flex gap-2 overflow-x-auto py-2 scrollbar-thin"
          >
            {relatedClips.slice(0, 10).map((relatedClip) => (
              <div role="listitem" key={relatedClip.id}>
                <button
                  type="button"
                  aria-label={relatedClip.name}
                  onClick={() => onSelectRelatedClip?.(relatedClip.id)}
                  className="relative block h-16 w-16 overflow-hidden rounded-md transition hover:ring-2 hover:ring-accent"
                >
                  {getMediaUrl(relatedClip.thumbnailUrl) ? (
                    <Image
                      src={getMediaUrl(relatedClip.thumbnailUrl)}
                      alt={relatedClip.name ?? ""}
                      width={relatedClip.width}
                      height={relatedClip.height}
                      sizes="64px"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-surface" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ShareButton
        clipId={clip.id}
        lang={lang}
        label={dict.clip.share}
        copiedLabel={dict.clip.copied}
        className="flex w-full items-center justify-center rounded-xl border border-border bg-surface px-4 py-3 font-medium transition-colors hover:bg-surface/80"
      />
    </>
  );
}

function ChevronToggle({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
    >
      <path d="M3.5 5.5L7 9L10.5 5.5" />
    </svg>
  );
}

function FieldCard({
  label,
  value,
  mono = false,
  isPlaceholder = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  isPlaceholder?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <p
        className={`break-words text-sm leading-6 ${
          isPlaceholder ? "italic text-muted" : ""
        } ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </section>
  );
}

function TokenSection({
  label,
  items,
  onSelectItem,
}: {
  label: string;
  items: { id: string; label: string }[];
  onSelectItem?: (itemId: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-4">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
        {label}
      </h4>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) =>
            onSelectItem ? (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item.id)}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-foreground"
              >
                {item.label}
              </button>
            ) : (
              <span
                key={item.id}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs"
              >
                {item.label}
              </span>
            )
          )}
        </div>
      ) : (
        <p className="text-sm italic text-muted">-</p>
      )}
    </section>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
