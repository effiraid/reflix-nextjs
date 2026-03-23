export interface Clip {
  id: string;
  name: string;
  ext: string;
  size: number;
  width: number;
  height: number;
  duration: number;
  tags: string[];
  folders: string[];
  star: number;
  annotation: string;
  url: string;
  palettes: { color: [number, number, number]; ratio: number }[];
  btime: number;
  mtime: number;
  i18n: {
    title: { ko: string; en: string };
    description: { ko: string; en: string };
  };
  videoUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  lqipBase64: string;
  category: string;
  relatedClips: string[];
}

export interface ClipIndex {
  id: string;
  name: string;
  tags: string[];
  folders: string[];
  star: number;
  category: string;
  width: number;
  height: number;
  duration: number;
  previewUrl: string;
  thumbnailUrl: string;
  lqipBase64: string;
}

export interface ClipIndexData {
  clips: ClipIndex[];
  totalCount: number;
  generatedAt: string;
}

export interface CategoryNode {
  slug: string;
  i18n: { ko: string; en: string };
  children?: Record<string, CategoryNode>;
}

export type CategoryTree = Record<string, CategoryNode>;

export interface TagGroup {
  id: string;
  name: { ko: string; en: string };
  parent: string;
  color?: string;
  tags: string[];
}

export interface ParentTagGroup {
  id: string;
  name: { ko: string; en: string };
  children: string[];
}

export interface TagGroupData {
  groups: TagGroup[];
  parentGroups: ParentTagGroup[];
}

export type Locale = "ko" | "en";

export type SortBy = "newest" | "rating" | "name";

export type ViewMode = "masonry" | "grid" | "list";
