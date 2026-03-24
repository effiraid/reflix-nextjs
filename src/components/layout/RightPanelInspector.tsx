"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getCategoryLabel } from "@/lib/categories";
import { formatClipDuration, getClipMediaKind } from "@/lib/clipInspector";
import { getMediaUrl } from "@/lib/mediaUrl";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Clip, Locale } from "@/lib/types";

interface RightPanelInspectorProps {
  clip: Clip;
  categories: CategoryTree;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
}

export function RightPanelInspector({
  clip,
  categories,
  lang,
  dict,
}: RightPanelInspectorProps) {
  const title = clip.i18n.title[lang] || clip.name;
  const thumbnailUrl = getMediaUrl(clip.thumbnailUrl);
  const previewUrl = getMediaUrl(clip.previewUrl);
  const [previewFailed, setPreviewFailed] = useState(false);
  const mediaKindKey = getClipMediaKind(clip.ext);
  const mediaKind =
    mediaKindKey === "video" ? dict.clip.video : dict.clip.image;
  const folderLabels = clip.folders.map((folderId) =>
    getCategoryLabel(folderId, categories, lang)
  );
  const palette = clip.palettes?.slice(0, 6) ?? [];
  const linkText = clip.url || dict.clip.noLink;
  const memoText = clip.annotation || "-";
  const hasLink = Boolean(clip.url);
  const hasMemo = Boolean(clip.annotation);

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewUrl]);

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
            className="h-full w-full object-cover"
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            sizes="320px"
            className="object-cover"
          />
        )}
      </div>

      {palette.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface/40 p-3">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
            {dict.clip.colorPalette}
          </div>
          <div className="flex flex-wrap gap-2">
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
      )}

      <div>
        <h3 className="text-lg font-semibold leading-tight">{title}</h3>
      </div>

      <FieldCard label={dict.clip.memo} value={memoText} isPlaceholder={!hasMemo} />

      <FieldCard
        label={dict.clip.sourceUrl}
        value={linkText}
        mono={hasLink}
        isPlaceholder={!hasLink}
      />

      <TokenSection label={dict.clip.folders} items={folderLabels} />

      <TokenSection label={dict.clip.tags} items={clip.tags} />

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

      <button
        type="button"
        className="flex w-full items-center justify-center rounded-xl border border-border bg-surface px-4 py-3 font-medium transition-colors hover:bg-surface/80"
      >
        {dict.clip.share}
      </button>
    </div>
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
        } ${mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </p>
    </section>
  );
}

function TokenSection({ label, items }: { label: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-4">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
        {label}
      </h4>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs"
            >
              {item}
            </span>
          ))}
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
