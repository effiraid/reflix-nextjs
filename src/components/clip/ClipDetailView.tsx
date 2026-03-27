import { ClipDetailsPanel } from "@/components/clip/ClipDetailsPanel";
import { ClipDetailLayout } from "@/components/clip/ClipDetailLayout";
import { ShareButton } from "@/components/clip/ShareButton";
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
  return (
    <ClipDetailLayout
      videoUrl={clip.videoUrl}
      thumbnailUrl={clip.thumbnailUrl}
      duration={clip.duration}
    >
      <ClipDetailsPanel
        clip={clip}
        categories={categories}
        lang={lang}
        dict={dict}
        tagI18n={tagI18n}
        className="lg:w-80 lg:shrink-0"
        pagefindBody
        headerAction={(
          <ShareButton
            clipId={clip.id}
            lang={lang}
            label={dict.clip.share}
            copiedLabel={dict.clip.copied}
            variant="icon-only"
            className="rounded-full border border-border bg-surface p-2 transition-colors hover:bg-surface/80"
          />
        )}
      />
    </ClipDetailLayout>
  );
}
