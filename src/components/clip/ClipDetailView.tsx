import { ClipDetailLayout } from "@/components/clip/ClipDetailLayout";
import { InspectorSidebarSections } from "@/components/clip/InspectorSidebarSections";
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
      lang={lang}
    >
      <aside
        data-pagefind-body
        className="w-full space-y-5 text-sm text-foreground lg:w-80 lg:shrink-0"
      >
        <div className="sr-only">
          {clip.i18n.title[lang] || clip.name} {clip.tags.join(" ")}{" "}
          {clip.aiTags?.description[lang] || clip.aiTags?.description.ko || ""}
        </div>
        <InspectorSidebarSections
          clip={clip}
          categories={categories}
          lang={lang}
          dict={dict}
          tagI18n={tagI18n}
        />
      </aside>
    </ClipDetailLayout>
  );
}
