"use client";

import { useState } from "react";
import { VideoPlayer } from "@/components/clip/VideoPlayer";
import { LandingClipCard } from "./LandingClipCard";
import { useFadeIn } from "./useFadeIn";
import { getTagDisplayLabel } from "@/lib/tagDisplay";
import type { BrowseClipRecord, Locale } from "@/lib/types";

interface LandingFeaturesProps {
  lang: Locale;
  tagI18n: Record<string, string>;
  featureClips: BrowseClipRecord[];
  dict: {
    featuresTitle: string;
    featuresSub: string;
    featureTagTitle: string;
    featureTagDesc: string;
    featureTagBadges: string;
    featureAiTitle: string;
    featureAiDesc: string;
    featureAiBadge: string;
    featurePlayerTitle: string;
    featurePlayerDesc: string;
    featurePlayerBadge: string;
    [key: string]: string;
  };
}

function TagBadgesOverlay({
  tags,
  duration,
}: {
  tags: string[];
  duration: number;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span className="truncate">{tags.join(", ")}</span>
        <span className="shrink-0 ml-2">{duration.toFixed(1)}s</span>
      </div>
    </div>
  );
}

function getAiOverlayDescription(
  clip: BrowseClipRecord,
  lang: Locale,
  fallback: string
) {
  return (
    clip.aiTags?.description[lang] ||
    clip.aiTags?.description.ko ||
    clip.aiTags?.description.en ||
    fallback.replaceAll("\n", " ")
  );
}

function getAiOverlayBadge(
  clip: BrowseClipRecord,
  lang: Locale,
  tagI18n: Record<string, string>,
  fallback: string
) {
  if (!clip.aiTags) {
    return fallback;
  }

  const emotion = clip.aiTags.emotion.find(Boolean);
  const action = clip.aiTags.actionType.find(Boolean);

  if (!emotion && !action) {
    return fallback;
  }

  const emotionPrefix = lang === "ko" ? "감정" : "Emotion";
  const actionPrefix = lang === "ko" ? "동작" : "Action";
  const parts: string[] = [];

  if (emotion) {
    parts.push(
      `${emotionPrefix}-${getTagDisplayLabel(emotion, lang, tagI18n)}`
    );
  }

  if (action) {
    parts.push(`${actionPrefix}-${getTagDisplayLabel(action, lang, tagI18n)}`);
  }

  return parts.length ? `AI: ${parts.join(" / ")}` : fallback;
}

function AiInsightOverlay({
  label,
  text,
  badge,
}: {
  label: string;
  text: string;
  badge: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-end p-3 md:p-5">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(270deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.24) 40%, rgba(0,0,0,0) 72%)",
        }}
      />
      <div className="relative max-w-[78%] text-right md:max-w-[60%]">
        <div className="mb-2 flex justify-end">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] text-white/55"
            style={{
              background: "rgba(0,0,0,0.22)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {label}
          </span>
        </div>
        <p
          className="text-[11px] leading-5 text-white/58 md:text-[12px]"
          style={{
            textShadow: "0 1px 12px rgba(0,0,0,0.42)",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 4,
            overflow: "hidden",
          }}
        >
          {text}
        </p>
        <div className="mt-3 flex justify-end">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-medium text-white/42"
            style={{
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {badge}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlayerControlsOverlay({ text }: { text: string }) {
  return (
    <div className="absolute bottom-3 left-3 right-3">
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2 text-[11px] text-white/80"
        style={{
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
        }}
      >
        <span>{text}</span>
        <div className="flex gap-1.5">
          <div className="h-1.5 w-12 rounded-full bg-white/20">
            <div className="h-1.5 w-5 rounded-full bg-white/60" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturePlaybackPlayer({ clip }: { clip: BrowseClipRecord }) {
  const [playbackRate, setPlaybackRate] = useState(0.25);

  return (
    <VideoPlayer
      videoUrl={clip.previewUrl}
      thumbnailUrl={clip.thumbnailUrl}
      duration={clip.duration}
      autoPlayMuted
      playbackRate={playbackRate}
      onPlaybackRateChange={setPlaybackRate}
      useBlobUrl
    />
  );
}

interface FeatureRowProps {
  title: string;
  description: string;
  clip: BrowseClipRecord;
  overlay: React.ReactNode;
  media?: React.ReactNode;
  reversed?: boolean;
  priority?: boolean;
}

function FeatureRow({
  title,
  description,
  clip,
  overlay,
  media,
  reversed = false,
  priority = false,
}: FeatureRowProps) {
  const { ref, style: fadeStyle } = useFadeIn();
  const textBlock = (
    <div className="flex flex-1 flex-col justify-center">
      <h3
        className="whitespace-pre-line text-[24px] font-semibold leading-tight text-white"
        style={{ letterSpacing: "-0.5px", wordBreak: "keep-all" }}
      >
        {title}
      </h3>
      <p
        className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#777]"
        style={{ wordBreak: "keep-all" }}
      >
        {description}
      </p>
    </div>
  );

  const clipBlock = (
    <div className="flex-1">
      {media ?? (
        <LandingClipCard
          clip={clip}
          autoPlay
          aspectRatio="16/9"
          overlay={overlay}
          priority={priority}
          className="w-full"
        />
      )}
    </div>
  );

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      style={fadeStyle}
      className="flex flex-col gap-8 md:flex-row md:items-center md:gap-16"
    >
      {reversed ? (
        <>
          {textBlock}
          {clipBlock}
        </>
      ) : (
        <>
          {clipBlock}
          {textBlock}
        </>
      )}
    </div>
  );
}

export function LandingFeatures({
  lang,
  tagI18n,
  featureClips,
  dict,
}: LandingFeaturesProps) {
  const aiOverlayLabel = lang === "ko" ? "AI 분석" : "AI Analysis";

  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="mb-16 text-center">
        <h2
          className="whitespace-pre-line text-[32px] font-bold text-white"
          style={{ letterSpacing: "-1px", wordBreak: "keep-all" }}
        >
          {dict.featuresTitle}
        </h2>
        <p
          className="mt-3 whitespace-pre-line text-[15px] text-[#777]"
          style={{ wordBreak: "keep-all" }}
        >
          {dict.featuresSub}
        </p>
      </div>

      <div className="flex flex-col gap-24">
        {/* Feature 1: Tag search — clip left, text right */}
        {featureClips[0] && (
          <FeatureRow
            title={dict.featureTagTitle}
            description={dict.featureTagDesc}
            clip={featureClips[0]}
            overlay={
              <TagBadgesOverlay
                tags={featureClips[0].tags ?? []}
                duration={featureClips[0].duration}
              />
            }
            priority
          />
        )}

        {/* Feature 2: AI analysis — text left, clip right (reversed) */}
        {featureClips[1] && (
          <FeatureRow
            title={dict.featureAiTitle}
            description={dict.featureAiDesc}
            clip={featureClips[1]}
            overlay={
              <AiInsightOverlay
                label={aiOverlayLabel}
                text={getAiOverlayDescription(
                  featureClips[1],
                  lang,
                  dict.featureAiDesc
                )}
                badge={getAiOverlayBadge(
                  featureClips[1],
                  lang,
                  tagI18n,
                  dict.featureAiBadge
                )}
              />
            }
            reversed
          />
        )}

        {/* Feature 3: Frame playback — clip left, text right */}
        {featureClips[2] && (
          <FeatureRow
            title={dict.featurePlayerTitle}
            description={dict.featurePlayerDesc}
            clip={featureClips[2]}
            overlay={
              <PlayerControlsOverlay text={dict.featurePlayerBadge} />
            }
            media={
              <FeaturePlaybackPlayer clip={featureClips[2]} />
            }
          />
        )}
      </div>
    </section>
  );
}
