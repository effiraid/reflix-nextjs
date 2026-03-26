import { VideoPlayer } from "@/components/clip/VideoPlayer";
import { ShareButton } from "@/components/clip/ShareButton";
import { formatClipDuration } from "@/lib/clipInspector";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Clip, Locale } from "@/lib/types";

interface ClipDetailViewProps {
  clip: Clip;
  lang: Locale;
  dict: Pick<Dictionary, "clip">;
}

export function ClipDetailView({ clip, lang, dict }: ClipDetailViewProps) {
  const title = clip.i18n.title[lang] || clip.name;
  const sizeLabel = `${Math.round(clip.size / 1024)} KB`;

  return (
    <div className="space-y-6">
      <VideoPlayer
        videoUrl={clip.videoUrl}
        thumbnailUrl={clip.thumbnailUrl}
        duration={clip.duration}
        useBlobUrl
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <ShareButton
            clipId={clip.id}
            lang={lang}
            label={dict.clip.share}
            copiedLabel={dict.clip.copied}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface/80"
          />
        </div>
        {clip.annotation ? (
          <p className="max-w-3xl text-sm leading-7 text-muted">
            {clip.annotation}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-surface/40 p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
          {dict.clip.tags}
        </h2>
        <div className="flex flex-wrap gap-2">
          {clip.tags.length > 0 ? (
            clip.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-sm italic text-muted">-</span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface/40 p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">
          {dict.clip.memo}
        </h2>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <DetailRow
            label={dict.clip.rating}
            value={`${"★".repeat(clip.star)}${"☆".repeat(Math.max(0, 5 - clip.star))}`}
          />
          <DetailRow
            label={dict.clip.duration}
            value={formatClipDuration(clip.duration)}
          />
          <DetailRow
            label={dict.clip.resolution}
            value={`${clip.width}×${clip.height}`}
          />
          <DetailRow label={dict.clip.size} value={sizeLabel} />
          <DetailRow label={dict.clip.format} value={clip.ext.toUpperCase()} />
        </dl>
      </section>

      {clip.relatedClips.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface/40 p-4">
          <h2 className="mb-2 text-lg font-semibold">{dict.clip.related}</h2>
          <p className="text-sm text-muted">
            {clip.relatedClips.length} related clip ids
          </p>
        </section>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/60 px-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
