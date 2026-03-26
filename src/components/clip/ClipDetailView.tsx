import { ClipDetailLayout } from "@/components/clip/ClipDetailLayout";
import { ShareButton } from "@/components/clip/ShareButton";
import { getStructuredAiTags } from "@/lib/aiTags";
import { getCategoryLabel } from "@/lib/categories";
import { formatClipDuration, getClipMediaKind } from "@/lib/clipInspector";
import { getTagDisplayLabels } from "@/lib/tagDisplay";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { CategoryTree, Clip, Locale } from "@/lib/types";

interface ClipDetailViewProps {
  clip: Clip;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
  categories: CategoryTree;
  tagI18n?: Record<string, string>;
}

export function ClipDetailView({
  clip,
  lang,
  dict,
  categories,
  tagI18n = {},
}: ClipDetailViewProps) {
  const title = clip.i18n.title[lang] || clip.name;
  const sizeLabel = `${Math.round(clip.size / 1024)} KB`;
  const mediaKindKey = getClipMediaKind(clip.ext);
  const mediaKind =
    mediaKindKey === "video" ? dict.clip.video : dict.clip.image;
  const folderLabels = clip.folders.map((folderId) =>
    getCategoryLabel(folderId, categories, lang)
  );
  const tagLabels = getTagDisplayLabels(clip.tags, lang, tagI18n);
  const aiTagTokens = getTagDisplayLabels(
    getStructuredAiTags(clip.aiTags),
    lang,
    tagI18n
  );
  const palette = clip.palettes?.slice(0, 6) ?? [];
  const memoText = clip.annotation || "-";
  const hasMemo = Boolean(clip.annotation);

  return (
    <ClipDetailLayout
      videoUrl={clip.videoUrl}
      thumbnailUrl={clip.thumbnailUrl}
      duration={clip.duration}
    >
      <aside
        data-pagefind-body
        className="w-full space-y-4 lg:w-80 lg:shrink-0"
      >
        <div className="sr-only">
          {title} {tagLabels.join(" ")} {aiTagTokens.join(" ")}{" "}
          {clip.aiTags?.description.ko ?? ""} {clip.aiTags?.description.en ?? ""}
        </div>
        {/* Title + Share */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          <ShareButton
            clipId={clip.id}
            lang={lang}
            label={dict.clip.share}
            copiedLabel={dict.clip.copied}
            variant="icon-only"
            className="shrink-0 rounded-full border border-border bg-surface p-2 transition-colors hover:bg-surface/80"
          />
        </div>

        {/* Memo */}
        <FieldCard
          label={dict.clip.memo}
          value={memoText}
          isPlaceholder={!hasMemo}
        />

        {/* Color Palette */}
        {palette.length > 0 && (
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
        )}

        {/* Folders */}
        <TokenSection label={dict.clip.folders} items={folderLabels} />

        {/* Tags */}
        <TokenSection label={dict.clip.tags} items={tagLabels} />

        {/* Properties */}
        <section className="rounded-2xl border border-border bg-surface/40 p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
            {dict.clip.properties}
          </h2>
          <dl className="space-y-2">
            <PropertyRow
              label={dict.clip.rating}
              value={`${"★".repeat(clip.star)}${"☆".repeat(Math.max(0, 5 - clip.star))}`}
            />
            <PropertyRow
              label={dict.clip.duration}
              value={formatClipDuration(clip.duration)}
            />
            <PropertyRow
              label={dict.clip.resolution}
              value={`${clip.width}×${clip.height}`}
            />
            <PropertyRow label={dict.clip.size} value={sizeLabel} />
            <PropertyRow
              label={dict.clip.format}
              value={`${clip.ext.toUpperCase()} · ${mediaKind}`}
            />
          </dl>
        </section>
      </aside>
    </ClipDetailLayout>
  );
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
