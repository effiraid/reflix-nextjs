#!/usr/bin/env node
/**
 * AI 태깅 파일럿 비교: Gemini 2.5 Flash (영상 입력) vs Twelve Labs
 *
 * Usage:
 *   GEMINI_API_KEY=xxx TWELVE_LABS_API_KEY=xxx node scripts/pilot-ai-tag-compare.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TWELVE_LABS_KEY = process.env.TWELVE_LABS_API_KEY;
const VIDEO_DIR = path.resolve("public/videos");
const DATA_DIR = path.resolve("src/data");

// Load clip data for context (existing tags)
const indexData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "index.json"), "utf-8"));
const clips = indexData.clips.slice(0, 3); // Test 3 clips

const TAG_PROMPT = `당신은 게임 애니메이션 분석 전문가입니다. 이 짧은 게임 애니메이션 클립을 분석해주세요.

기존 수동 태그: {EXISTING_TAGS}
클립 이름: {CLIP_NAME}

다음 형식으로 JSON을 반환해주세요:
{
  "actionType": ["동작 유형 태그들 (한국어)"],
  "emotion": ["감정 태그들 (한국어)"],
  "composition": ["구도 태그들 - 예: 클로즈업, 풀샷, 로우앵글 등"],
  "pacing": "빠름 | 보통 | 느림",
  "characterType": ["캐릭터 유형 태그들"],
  "effects": ["시각 이펙트 태그들 - 예: 파티클, 잔상, 카메라흔들림 등"],
  "description": {
    "ko": "한국어 자연어 설명 (2-3문장)",
    "en": "English description (2-3 sentences)"
  }
}

기존 태그를 참고하되, 태그에 없는 시각적 요소(구도, 이펙트, 색감, 움직임의 질감)를 추가로 분석해주세요.
JSON만 반환하고 다른 텍스트는 포함하지 마세요.`;

// ─── Gemini 2.5 Flash ───────────────────────────────────────
async function testGemini(clip) {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const videoPath = path.join(VIDEO_DIR, `${clip.id}.mp4`);
  const videoData = fs.readFileSync(videoPath);
  const base64Video = videoData.toString("base64");

  const prompt = TAG_PROMPT
    .replace("{EXISTING_TAGS}", clip.tags.join(", "))
    .replace("{CLIP_NAME}", clip.name);

  const start = Date.now();
  const result = await model.generateContent([
    { inlineData: { mimeType: "video/mp4", data: base64Video } },
    prompt,
  ]);
  const elapsed = Date.now() - start;

  const text = result.response.text();
  // Extract JSON from response (may have markdown code fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let parsed = null;
  if (jsonMatch) {
    try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = null; }
  }

  return { raw: text, parsed, elapsed, model: "gemini-2.5-flash" };
}

// ─── Twelve Labs ────────────────────────────────────────────
async function createTwelveLabsIndex() {
  const res = await fetch("https://api.twelvelabs.io/v1.3/indexes", {
    method: "POST",
    headers: {
      "x-api-key": TWELVE_LABS_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      index_name: `reflix-pilot-${Date.now()}`,
      models: [
        {
          model_name: "marengo2.7",
          model_options: ["visual"],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Index creation failed: ${JSON.stringify(data)}`);
  return data._id;
}

async function uploadToTwelveLabs(indexId, clip) {
  const videoPath = path.join(VIDEO_DIR, `${clip.id}.mp4`);

  const formData = new FormData();
  formData.append("index_id", indexId);
  formData.append("video_file", new Blob([fs.readFileSync(videoPath)], { type: "video/mp4" }), `${clip.id}.mp4`);
  formData.append("language", "ko");

  const res = await fetch("https://api.twelvelabs.io/v1.3/tasks", {
    method: "POST",
    headers: { "x-api-key": TWELVE_LABS_KEY },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload failed: ${JSON.stringify(data)}`);
  return data._id;
}

async function waitForTask(taskId) {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`https://api.twelvelabs.io/v1.3/tasks/${taskId}`, {
      headers: { "x-api-key": TWELVE_LABS_KEY },
    });
    const data = await res.json();
    if (data.status === "ready") return data.video_id;
    if (data.status === "failed") throw new Error(`Task failed: ${JSON.stringify(data)}`);
    await new Promise(r => setTimeout(r, 5000)); // 5sec poll
  }
  throw new Error("Task timed out after 5 minutes");
}

async function generateFromTwelveLabs(videoId, clip) {
  const prompt = `이 게임 애니메이션 클립을 분석해주세요. 다음을 포함해주세요:
- 동작 유형 (예: 베기, 달리기, 방어)
- 감정 (예: 분노, 슬픔, 기쁨)
- 구도 (예: 클로즈업, 풀샷)
- 속도감 (빠름/보통/느림)
- 시각 이펙트 (예: 파티클, 잔상)
- 한국어 설명 2-3문장
기존 태그: ${clip.tags.join(", ")}`;

  const start = Date.now();
  const res = await fetch("https://api.twelvelabs.io/v1.3/generate", {
    method: "POST",
    headers: {
      "x-api-key": TWELVE_LABS_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ video_id: videoId, prompt }),
  });
  const elapsed = Date.now() - start;
  const data = await res.json();
  if (!res.ok) throw new Error(`Generate failed: ${JSON.stringify(data)}`);
  return { raw: data.data, elapsed, model: "twelve-labs-marengo2.7" };
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  console.log("=== AI 태깅 파일럿 비교 ===\n");
  console.log(`테스트 클립: ${clips.length}개\n`);

  // ── Gemini ──
  if (GEMINI_KEY) {
    console.log("━━━ Gemini 2.5 Flash (영상 직접 입력) ━━━\n");
    for (const clip of clips) {
      console.log(`▶ ${clip.name.slice(0, 40)}`);
      console.log(`  기존 태그: ${clip.tags.join(", ")}`);
      try {
        const result = await testGemini(clip);
        console.log(`  ⏱ ${result.elapsed}ms`);
        if (result.parsed) {
          console.log(`  동작: ${result.parsed.actionType?.join(", ") || "N/A"}`);
          console.log(`  감정: ${result.parsed.emotion?.join(", ") || "N/A"}`);
          console.log(`  구도: ${result.parsed.composition?.join(", ") || "N/A"}`);
          console.log(`  속도: ${result.parsed.pacing || "N/A"}`);
          console.log(`  이펙트: ${result.parsed.effects?.join(", ") || "N/A"}`);
          console.log(`  설명(ko): ${result.parsed.description?.ko || "N/A"}`);
          console.log(`  설명(en): ${result.parsed.description?.en || "N/A"}`);
        } else {
          console.log(`  ⚠ JSON 파싱 실패. Raw:\n  ${result.raw.slice(0, 200)}`);
        }
      } catch (err) {
        console.log(`  ❌ 에러: ${err.message}`);
      }
      console.log();
    }
  } else {
    console.log("⚠ GEMINI_API_KEY 없음 — Gemini 테스트 스킵\n");
  }

  // ── Twelve Labs ──
  if (TWELVE_LABS_KEY) {
    console.log("━━━ Twelve Labs (영상 업로드 + 분석) ━━━\n");
    try {
      console.log("인덱스 생성 중...");
      const indexId = await createTwelveLabsIndex();
      console.log(`인덱스 ID: ${indexId}\n`);

      for (const clip of clips) {
        console.log(`▶ ${clip.name.slice(0, 40)}`);
        console.log(`  기존 태그: ${clip.tags.join(", ")}`);
        try {
          console.log("  업로드 중...");
          const taskId = await uploadToTwelveLabs(indexId, clip);
          console.log(`  처리 대기 중 (최대 5분)...`);
          const videoId = await waitForTask(taskId);
          const result = await generateFromTwelveLabs(videoId, clip);
          console.log(`  ⏱ ${result.elapsed}ms (생성만)`);
          console.log(`  결과:\n  ${result.raw?.slice(0, 500) || "N/A"}`);
        } catch (err) {
          console.log(`  ❌ 에러: ${err.message}`);
        }
        console.log();
      }
    } catch (err) {
      console.log(`❌ Twelve Labs 초기화 에러: ${err.message}`);
    }
  } else {
    console.log("⚠ TWELVE_LABS_API_KEY 없음 — Twelve Labs 테스트 스킵\n");
  }
}

main().catch(console.error);
