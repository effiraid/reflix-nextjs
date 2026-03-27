"use client";

import { LandingClipCard } from "./LandingClipCard";
import { useFadeIn } from "./useFadeIn";
import type { BrowseClipRecord } from "@/lib/types";

interface LandingFeaturesProps {
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

function TagBadgesOverlay({ badges }: { badges: string[] }) {
  return (
    <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
          style={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
          }}
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

function AiBadgeOverlay({ text }: { text: string }) {
  return (
    <div className="absolute bottom-3 left-3">
      <span
        className="rounded-full px-3 py-1.5 text-[11px] font-medium text-white"
        style={{
          background: "rgba(99,102,241,0.25)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(99,102,241,0.3)",
        }}
      >
        {text}
      </span>
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

interface FeatureRowProps {
  title: string;
  description: string;
  clip: BrowseClipRecord;
  overlay: React.ReactNode;
  reversed?: boolean;
  priority?: boolean;
}

function FeatureRow({
  title,
  description,
  clip,
  overlay,
  reversed = false,
  priority = false,
}: FeatureRowProps) {
  const { ref, style: fadeStyle } = useFadeIn();
  const textBlock = (
    <div className="flex flex-1 flex-col justify-center">
      <h3
        className="text-[24px] font-semibold leading-tight text-white"
        style={{ letterSpacing: "-0.5px" }}
      >
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-[#777]">
        {description}
      </p>
    </div>
  );

  const clipBlock = (
    <div className="flex-1">
      <LandingClipCard
        clip={clip}
        autoPlay
        aspectRatio="16/9"
        overlay={overlay}
        priority={priority}
        className="w-full"
      />
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

export function LandingFeatures({ featureClips, dict }: LandingFeaturesProps) {
  const tagBadges = dict.featureTagBadges.split(",");

  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="mb-16 text-center">
        <h2
          className="text-[32px] font-bold text-white"
          style={{ letterSpacing: "-1px" }}
        >
          {dict.featuresTitle}
        </h2>
        <p className="mt-3 text-[15px] text-[#777]">{dict.featuresSub}</p>
      </div>

      <div className="flex flex-col gap-24">
        {/* Feature 1: Tag search — clip left, text right */}
        {featureClips[0] && (
          <FeatureRow
            title={dict.featureTagTitle}
            description={dict.featureTagDesc}
            clip={featureClips[0]}
            overlay={<TagBadgesOverlay badges={tagBadges} />}
            priority
          />
        )}

        {/* Feature 2: AI analysis — text left, clip right (reversed) */}
        {featureClips[1] && (
          <FeatureRow
            title={dict.featureAiTitle}
            description={dict.featureAiDesc}
            clip={featureClips[1]}
            overlay={<AiBadgeOverlay text={dict.featureAiBadge} />}
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
          />
        )}
      </div>
    </section>
  );
}
