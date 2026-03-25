"use client";

import type { ComponentType } from "react";
import type { CategoryNode, CategoryTree, Locale } from "@/lib/types";
import { useFilterStore } from "@/stores/filterStore";
import { collectDescendantIds } from "@/lib/categories";
import type { LucideProps } from "lucide-react";
import {
  ChevronRight,
  Clapperboard,
  Swords,
  PersonStanding,
  Video,
  Gamepad2,
  MessageCircle,
  MessagesSquare,
  Pause,
  Zap,
  Smile,
  MoveRight,
  Footprints,
  Wind,
  ArrowUpFromDot,
  Shuffle,
  Shield,
  Sword,
  Orbit,
  Flame,
  Undo2,
  Sparkles,
  BatteryCharging,
  CircleAlert,
  CircleDashed,
  Skull,
  Target,
  Axe,
  Hammer,
  Grip,
  ShieldHalf,
  Crosshair,
  Wand2,
  Focus,
  Hand,
  Dumbbell,
  LayoutTemplate,
  UserRound,
} from "lucide-react";

const FOLDER_ICONS: Record<string, ComponentType<LucideProps>> = {
  // 최상위
  weapons: Swords,
  poses: PersonStanding,
  // 이동
  movement: MoveRight,
  walk: Footprints,
  run: Footprints,
  sprint: Wind,
  jump: ArrowUpFromDot,
  "movement-other": Shuffle,
  // 교전
  combat: Swords,
  "combat-ready": Shield,
  attack: Sword,
  "melee-attack": Sword,
  "ranged-attack": Crosshair,
  ultimate: Flame,
  return: Undo2,
  buff: Sparkles,
  charge: BatteryCharging,
  // 피격
  "hit-reaction": CircleAlert,
  hit: Target,
  stun: CircleDashed,
  death: Skull,
  // 대기
  idle: Pause,
  "idle-general": Pause,
  "idle-combat": Zap,
  // 대화
  dialogue: MessagesSquare,
  "dialogue-main": MessageCircle,
  "dialogue-cinematic": Clapperboard,
  "dialogue-ingame": MessageCircle,
  "moving-hold": MoveRight,
  facial: Smile,
  "dialogue-idle": Pause,
  "dialogue-idle-combat": Zap,
  "emote-ingame": Smile,
  // 리액션
  reaction: CircleAlert,
  surprise: Zap,
  pain: CircleDashed,
  emotion: Smile,
  // 생활 동작
  daily: PersonStanding,
  "sit-lie-stand": UserRound,
  "grab-release-lift": Hand,
  "daily-other": Shuffle,
  // 연출 기법
  "direction-video": Video,
  effect: Sparkles,
  transition: Shuffle,
  // 게임 연출
  "direction-game": Gamepad2,
  entrance: ArrowUpFromDot,
  selection: Focus,
  victory: Flame,
  gacha: Orbit,
  // 무기 > 둔기류
  melee: Axe,
  sword: Sword,
  dagger: Sword,
  blunt: Hammer,
  spear: Grip,
  shield: ShieldHalf,
  // 무기 > 원거리류
  ranged: Crosshair,
  magic: Wand2,
  bow: Focus,
  gun: Crosshair,
  // 무기 > 기타
  "other-weapons": Hand,
  body: Dumbbell,
  // 포즈
  preset: LayoutTemplate,
  "pose-idle": UserRound,
};

interface FolderTreeProps {
  categories: CategoryTree;
  folderCounts: Record<string, number>;
  lang: Locale;
  expandedFolderIds: string[];
  onFolderClick: (selection: {
    folderId: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
  }) => void;
  onFolderExpandToggle: (folderId: string) => void;
}

export function FolderTree({
  categories,
  folderCounts,
  lang,
  expandedFolderIds,
  onFolderClick,
  onFolderExpandToggle,
}: FolderTreeProps) {
  return (
    <div className="space-y-1">
      {Object.entries(categories).map(([id, node]) => (
        <FolderNode
          key={id}
          id={id}
          node={node}
          categories={categories}
          folderCounts={folderCounts}
          lang={lang}
          depth={0}
          expandedFolderIds={expandedFolderIds}
          onFolderClick={onFolderClick}
          onFolderExpandToggle={onFolderExpandToggle}
        />
      ))}
    </div>
  );
}

function FolderNode({
  id,
  node,
  categories,
  folderCounts,
  lang,
  depth,
  expandedFolderIds,
  onFolderClick,
  onFolderExpandToggle,
}: {
  id: string;
  node: CategoryNode;
  categories: CategoryTree;
  folderCounts: Record<string, number>;
  lang: Locale;
  depth: number;
  expandedFolderIds: string[];
  onFolderClick: (selection: {
    folderId: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
  }) => void;
  onFolderExpandToggle: (folderId: string) => void;
}) {
  const { selectedFolders } = useFilterStore();
  const hasChildren = node.children && Object.keys(node.children).length > 0;
  const expanded = expandedFolderIds.includes(id);
  const allIds = collectDescendantIds(id, categories);
  const isSelected = allIds.some((fid) => selectedFolders.includes(fid));
  const count = allIds.reduce((sum, fid) => sum + (folderCounts[fid] || 0), 0);
  const Icon = FOLDER_ICONS[node.slug];

  return (
    <div>
      <div
        onClick={(event) =>
          onFolderClick({
            folderId: id,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
          })}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-[13px] transition-colors hover:bg-surface-hover ${
          isSelected ? "bg-accent/10 text-accent" : ""
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFolderExpandToggle(id);
            }}
            className="w-4 shrink-0 flex items-center justify-center text-muted"
          >
            <ChevronRight
              size={14}
              className={`transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        )}
        {!hasChildren && <span className="w-4 shrink-0" />}
        {Icon && (
          <Icon
            size={14}
            className={`shrink-0 ${isSelected ? "text-accent" : "text-muted"}`}
          />
        )}
        <span className="flex-1 truncate">
          {node.i18n[lang]}
        </span>
        {count > 0 && (
          <span className="text-[11px] text-muted">{count}</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {Object.entries(node.children!).map(([childId, childNode]) => (
            <FolderNode
              key={childId}
              id={childId}
              node={childNode}
              categories={categories}
              folderCounts={folderCounts}
              lang={lang}
              depth={depth + 1}
              expandedFolderIds={expandedFolderIds}
              onFolderClick={onFolderClick}
              onFolderExpandToggle={onFolderExpandToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
