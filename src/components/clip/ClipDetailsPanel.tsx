import type { ReactNode } from "react";
import { getCategoryLabel } from "@/lib/categories";
import { formatClipDuration, getClipMediaKind } from "@/lib/clipInspector";
import { getTagDisplayLabels } from "@/lib/tagDisplay";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { BrowseClipRecord, CategoryTree, Clip, Locale } from "@/lib/types";

interface ClipDetailsPanelProps {
  clip: BrowseClipRecord | Clip;
  categories: CategoryTree;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
  tagI18n?: Record<string, string>;
  headerAction?: ReactNode;
  footer?: ReactNode;
  className?: string;
  pagefindBody?: boolean;
}

export function ClipDetailsPanel({
  clip,
  categories,
  lang,
  dict,
  tagI18n = {},
  headerAction,
  footer,
  className = "",
  pagefindBody = false,
}: ClipDetailsPanelProps) {
  const detailedClip = isDetailedClip(clip) ? clip : null;
  const title = detailedClip?.i18n.title[lang] || clip.name;
  const folderLabels = (clip.folders ?? []).map((folderId) =>
    getCategoryLabel(folderId, categories, lang)
  );
  const tagLabels = getTagDisplayLabels(clip.tags ?? [], lang, tagI18n);
  const palette = detailedClip?.palettes?.slice(0, 6) ?? [];
  const memoText = detailedClip?.annotation || "-";
  const hasMemo = Boolean(detailedClip?.annotation);
  const propertyRows = [
    {
      label: dict.clip.rating,
      value: `${"★".repeat(clip.star)}${"☆".repeat(Math.max(0, 5 - clip.star))}`,
    },
    {
      label: dict.clip.duration,
      value: formatClipDuration(clip.duration),
    },
    {
      label: dict.clip.resolution,
      value: `${clip.width}×${clip.height}`,
    },
    ...(detailedClip
      ? [
          {
            label: dict.clip.size,
            value: `${Math.round(detailedClip.size / 1024)} KB`,
          },
          {
            label: dict.clip.format,
            value: `${detailedClip.ext.toUpperCase()} · ${
              getClipMediaKind(detailedClip.ext) === "video"
                ? dict.clip.video
                : dict.clip.image
            }`,
          },
        ]
      : []),
  ];

  return (
    <aside
      data-pagefind-body={pagefindBody || undefined}
      className={`w-full space-y-4 ${className}`.trim()}
    >
      {pagefindBody ? (
        <div className="sr-only">
          {title} {tagLabels.join(" ")}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold leading-tight tracking-tight">{title}</h1>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      <FieldCard
        label={dict.clip.memo}
        value={memoText}
        isPlaceholder={!hasMemo}
      />

      {palette.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface/40 p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
            {dict.clip.colorPalette}
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {palette.map((swatch, index) => (
              <div
                key={`${swatch.color.join("-")}-${index}`}
                className="h-7 w-7 rounded-full border border-white/10 shadow-sm"
                style={{
                  backgroundColor: `rgb(${swatch.color[0]}, ${swatch.color[1]}, ${swatch.color[2]})`,
                }}
                title={`${swatch.ratio}%`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <TokenSection label={dict.clip.folders} items={folderLabels} />
      <TokenSection label={dict.clip.tags} items={tagLabels} />

      <section className="rounded-2xl border border-border bg-surface/40 p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
          {dict.clip.properties}
        </h2>
        <dl className="space-y-2">
          {propertyRows.map((row) => (
            <PropertyRow
              key={row.label}
              label={row.label}
              value={row.value}
            />
          ))}
        </dl>
      </section>

      {footer}
    </aside>
  );
}

function isDetailedClip(clip: BrowseClipRecord | Clip): clip is Clip {
  return "ext" in clip && "size" in clip && "i18n" in clip;
}

function FieldCard({
  label,
  value,
  isPlaceholder = false,
}: {
  label: string;
  value: string;
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
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
        {label}
      </h2>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span
              key={`${item}-${index}`}
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
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
