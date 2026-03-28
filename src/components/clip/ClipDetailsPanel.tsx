import type { ReactNode } from "react";
import { ClipRatingPanel } from "@/components/clip/ClipRatingPanel";
import { getStructuredAiTags } from "@/lib/aiTags";
import { formatClipDuration } from "@/lib/clipInspector";
import { getTagDisplayLabels } from "@/lib/tagDisplay";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { BrowseClipRecord, Clip, Locale } from "@/lib/types";

interface ClipDetailsPanelProps {
  clip: BrowseClipRecord | Clip;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
  tagI18n?: Record<string, string>;
  footer?: ReactNode;
  className?: string;
  pagefindBody?: boolean;
}

export function ClipDetailsPanel({
  clip,
  lang,
  dict,
  tagI18n = {},
  footer,
  className = "",
  pagefindBody = false,
}: ClipDetailsPanelProps) {
  const title = isDetailedClip(clip) ? clip.i18n.title[lang] || clip.name : clip.name;
  const tagLabels = getTagDisplayLabels(clip.tags ?? [], lang, tagI18n);
  const hasAiAnalysis = Object.prototype.hasOwnProperty.call(clip, "aiTags");
  const aiStructuredTags =
    ("aiStructuredTags" in clip ? clip.aiStructuredTags : undefined) ??
    getStructuredAiTags(clip.aiTags);
  const aiTagTokens = getTagDisplayLabels(aiStructuredTags, lang, tagI18n);
  const aiDescription = clip.aiTags
    ? clip.aiTags.description[lang] || clip.aiTags.description.ko
    : null;

  return (
    <div
      data-pagefind-body={pagefindBody || undefined}
      className={`flex w-full flex-col gap-3 ${className}`.trim()}
    >
      {pagefindBody ? (
        <div className="sr-only">
          {title} {tagLabels.join(" ")} {aiTagTokens.join(" ")} {aiDescription ?? ""}
        </div>
      ) : null}

      <ClipRatingPanel clipId={clip.id} lang={lang} />

      {hasAiAnalysis ? (
        <section className="rounded-2xl border border-accent/35 bg-[radial-gradient(circle_at_top_right,rgba(96,165,250,0.16),transparent_42%),linear-gradient(180deg,rgba(96,165,250,0.14),rgba(255,255,255,0.04))] p-4 shadow-[0_8px_24px_rgba(37,99,235,0.14)]">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-foreground/90">
            {dict.clip.aiAnalysis}
          </h2>
          {clip.aiTags === null ? (
            <p className="text-xs italic text-muted">{dict.clip.aiPending}</p>
          ) : aiDescription ? (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-muted">{aiDescription}</p>
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
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface/40 p-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted">
          {dict.clip.tags}
        </h2>
        {tagLabels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tagLabels.map((item, index) => (
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

      <dl className="rounded-2xl border border-border bg-surface/40 p-4 space-y-3 text-sm">
        <PropertyRow
          label={dict.clip.duration}
          value={formatClipDuration(clip.duration)}
        />
      </dl>

      {footer ? <div className="mt-auto">{footer}</div> : null}
    </div>
  );
}

function isDetailedClip(clip: BrowseClipRecord | Clip): clip is Clip {
  return "ext" in clip && "size" in clip && "i18n" in clip;
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
