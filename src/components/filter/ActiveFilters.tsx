"use client";

import { useFilterStore } from "@/stores/filterStore";

interface ActiveFiltersProps {
  onClearAll: () => void;
  onRemoveTag: (tag: string) => void;
  onRemoveExcludeTag: (tag: string) => void;
  onRemoveFolder: (folderId: string) => void;
  onClearStar: () => void;
  onClearCategory: () => void;
}

export function ActiveFilters({
  onClearAll,
  onRemoveTag,
  onRemoveExcludeTag,
  onRemoveFolder,
  onClearStar,
  onClearCategory,
}: ActiveFiltersProps) {
  const { selectedTags, excludedTags, selectedFolders, starFilter, category } =
    useFilterStore();

  const hasFilters =
    selectedTags.length > 0 ||
    excludedTags.length > 0 ||
    selectedFolders.length > 0 ||
    starFilter !== null ||
    category !== null;

  if (!hasFilters) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border overflow-x-auto">
      {category && (
        <FilterChip label={category} onRemove={onClearCategory} />
      )}
      {selectedFolders.map((f) => (
        <FilterChip key={f} label={f} onRemove={() => onRemoveFolder(f)} />
      ))}
      {selectedTags.map((t) => (
        <FilterChip key={t} label={t} onRemove={() => onRemoveTag(t)} />
      ))}
      {excludedTags.map((t) => (
        <FilterChip key={`ex-${t}`} label={`−${t}`} variant="exclude" onRemove={() => onRemoveExcludeTag(t)} />
      ))}
      {starFilter !== null && (
        <FilterChip
          label={`★${starFilter}+`}
          onRemove={onClearStar}
        />
      )}
      <button
        onClick={onClearAll}
        className="text-xs text-muted hover:text-foreground shrink-0"
      >
        Clear all
      </button>
    </div>
  );
}

function FilterChip({
  label,
  variant = "default",
  onRemove,
}: {
  label: string;
  variant?: "default" | "exclude";
  onRemove: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full shrink-0 ${
        variant === "exclude"
          ? "bg-red-500/10 text-red-600 dark:text-red-400 line-through"
          : "bg-surface"
      }`}
    >
      {label}
      <button
        onClick={onRemove}
        className="hover:text-accent"
      >
        ×
      </button>
    </span>
  );
}
