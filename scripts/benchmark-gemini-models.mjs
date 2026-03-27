#!/usr/bin/env node
/**
 * Gemini 모델 벤치마크: 동일 영상 + 동일 프롬프트로 여러 모델 비교
 *
 * Usage:
 *   GEMINI_API_KEY=xxx node scripts/benchmark-gemini-models.mjs
 *
 * 테스트 모델:
 *   - gemini-2.5-flash (baseline, 기존 결과 재활용)
 *   - gemini-2.5-flash-lite
 *   - gemini-2.5-pro
 *   - gemini-3-flash-preview
 *   - gemini-3.1-flash-lite-preview
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Load .env.local
const envPath = path.join(PROJECT_ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1);
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY is required");
  process.exit(1);
}

const BASE_URL = "https://generativelanguage.googleapis.com";

const MODELS = [
  { id: "gemini-2.5-flash-lite", priceIn: 0.10, priceOut: 0.40 },
  { id: "gemini-2.5-flash", priceIn: 0.30, priceOut: 2.50 },
  { id: "gemini-2.5-pro", priceIn: 1.25, priceOut: 10.00 },
  { id: "gemini-3-flash-preview", priceIn: 0.50, priceOut: 3.00 },
  { id: "gemini-3.1-flash-lite-preview", priceIn: 0.25, priceOut: 1.50 },
];

const SAMPLE_IDS = [
  "L3TR52T310BLE",   // 5.8MB - 패싸움 전투씬 (복잡)
  "L3TR52T22TPVR",   // 798KB - 일어나기 (중간)
  "L3TR52T2K3FY9",   // 251KB - 호흡 (단순)
];

// ── Gemini File API helpers ─────────────────────────────────

async function uploadFile(filePath, displayName) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;

  const startRes = await fetch(`${BASE_URL}/upload/v1beta/files?key=${API_KEY}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(fileSize),
      "X-Goog-Upload-Header-Content-Type": "video/mp4",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });

  if (!startRes.ok) {
    throw new Error(`Upload start failed: ${await startRes.text()}`);
  }

  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(fileSize),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: fileBuffer,
  });

  const data = JSON.parse(await uploadRes.text());
  if (!uploadRes.ok) throw new Error(`Upload failed: ${data?.error?.message || "unknown"}`);
  return data.file;
}

async function waitForActive(fileName, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${BASE_URL}/v1beta/${fileName}?key=${API_KEY}`);
    const data = await res.json();
    const file = data.file ?? data;
    const state = typeof file.state === "string" ? file.state : file.state?.name || "";

    if (state === "ACTIVE") return file;
    if (state === "FAILED") throw new Error("File processing failed");

    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error("File did not become ACTIVE");
}

async function deleteFile(fileName) {
  try {
    await fetch(`${BASE_URL}/v1beta/${fileName}?key=${API_KEY}`, { method: "DELETE" });
  } catch { /* best effort */ }
}

// ── Prompt (from ai-tagging.mjs) ───────────────────────────

function buildPrompt(clipName, existingTags) {
  const tagText = existingTags?.length ? existingTags.join(", ") : "없음";
  return `당신은 게임 애니메이션 분석 전문가입니다. 이 짧은 게임 애니메이션 클립을 분석해주세요.

기존 수동 태그: ${tagText}
클립 이름: ${clipName}

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
}

function extractJson(text) {
  if (!text?.trim()) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text.trim();
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try { return JSON.parse(jsonMatch[0]); } catch { return null; }
}

// ── Generate content with a model ──────────────────────────

async function generateWithModel(modelId, fileUri, fileMimeType, clipName, existingTags) {
  const prompt = buildPrompt(clipName, existingTags);

  const start = Date.now();
  const res = await fetch(`${BASE_URL}/v1beta/models/${modelId}:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { file_data: { mime_type: fileMimeType, file_uri: fileUri } },
          { text: prompt },
        ],
      }],
    }),
  });

  const elapsed = Date.now() - start;
  const data = await res.json();

  if (!res.ok) {
    return {
      model: modelId,
      elapsed,
      error: data?.error?.message || `HTTP ${res.status}`,
      parsed: null,
      raw: null,
      tokenUsage: null,
    };
  }

  const text = (data?.candidates ?? [])
    .flatMap(c => c?.content?.parts ?? [])
    .map(p => p?.text)
    .filter(Boolean)
    .join("\n");

  const usage = data?.usageMetadata || null;

  return {
    model: modelId,
    elapsed,
    error: null,
    parsed: extractJson(text),
    raw: text,
    tokenUsage: usage,
  };
}

// ── Quality scoring ────────────────────────────────────────

function scoreResult(result) {
  if (result.error || !result.parsed) return { total: 0, breakdown: {} };

  const p = result.parsed;
  const tagCount =
    (p.actionType?.length || 0) +
    (p.emotion?.length || 0) +
    (p.composition?.length || 0) +
    (p.characterType?.length || 0) +
    (p.effects?.length || 0);

  const hasDescription = Boolean(p.description?.ko && p.description?.en);
  const hasPacing = Boolean(p.pacing);
  const descLenKo = p.description?.ko?.length || 0;
  const descLenEn = p.description?.en?.length || 0;

  // Score: richness (tag count) + completeness (all fields) + description depth
  const richness = Math.min(tagCount / 15, 1) * 40;        // 0-40
  const completeness = (hasDescription ? 20 : 0) + (hasPacing ? 10 : 0); // 0-30
  const depth = Math.min((descLenKo + descLenEn) / 400, 1) * 30; // 0-30

  return {
    total: Math.round(richness + completeness + depth),
    breakdown: { tagCount, richness: Math.round(richness), completeness, depth: Math.round(depth), descLenKo, descLenEn },
  };
}

// ── Cost estimation ────────────────────────────────────────

function estimateCost(modelDef, tokenUsage) {
  if (!tokenUsage) return null;
  const inTokens = tokenUsage.promptTokenCount || 0;
  const outTokens = tokenUsage.candidatesTokenCount || tokenUsage.totalTokenCount - inTokens || 0;
  const cost = (inTokens / 1_000_000) * modelDef.priceIn + (outTokens / 1_000_000) * modelDef.priceOut;
  return { inTokens, outTokens, cost };
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  const indexData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "src/data/index.json"), "utf8"));
  const clipMap = Object.fromEntries(indexData.clips.map(c => [c.id, c]));

  console.log("═══════════════════════════════════════════════");
  console.log("  Gemini 모델 벤치마크 — AI 태깅 가성비 비교");
  console.log("═══════════════════════════════════════════════\n");
  console.log(`모델 수: ${MODELS.length}`);
  console.log(`샘플 클립: ${SAMPLE_IDS.length}개\n`);

  const results = [];

  for (const clipId of SAMPLE_IDS) {
    const clip = clipMap[clipId];
    if (!clip) { console.log(`⚠ 클립 ${clipId} 없음, 스킵`); continue; }

    const videoPath = path.join(PROJECT_ROOT, "public/videos", `${clipId}.mp4`);
    const fileSize = fs.statSync(videoPath).size;

    console.log(`━━━ ${clip.name.slice(0, 50)} ━━━`);
    console.log(`    ID: ${clipId} | ${(fileSize/1024).toFixed(0)}KB | 태그: ${(clip.tags||[]).length}개\n`);

    // Upload once, test all models
    console.log("    📤 파일 업로드 중...");
    let uploadedFile;
    try {
      uploadedFile = await uploadFile(videoPath, clipId);
      console.log(`    ✓ 업로드 완료: ${uploadedFile.name}`);
    } catch (err) {
      console.log(`    ✗ 업로드 실패: ${err.message}`);
      continue;
    }

    // Wait for processing
    console.log("    ⏳ 처리 대기 중...");
    let activeFile;
    try {
      activeFile = await waitForActive(uploadedFile.name);
      console.log("    ✓ 파일 활성화 완료\n");
    } catch (err) {
      console.log(`    ✗ 처리 실패: ${err.message}`);
      await deleteFile(uploadedFile.name);
      continue;
    }

    // Test each model
    for (const modelDef of MODELS) {
      process.stdout.write(`    🔄 ${modelDef.id.padEnd(30)} `);
      const result = await generateWithModel(
        modelDef.id,
        activeFile.uri,
        activeFile.mimeType || "video/mp4",
        clip.name,
        clip.tags,
      );

      const score = scoreResult(result);
      const cost = estimateCost(modelDef, result.tokenUsage);

      results.push({
        clipId,
        clipName: clip.name,
        ...result,
        score,
        cost,
        modelDef,
      });

      if (result.error) {
        console.log(`❌ ${result.error.slice(0, 60)}`);
      } else {
        const costStr = cost ? `$${cost.cost.toFixed(6)}` : "N/A";
        const tokStr = cost ? `${cost.inTokens}in/${cost.outTokens}out` : "";
        console.log(`✓ ${result.elapsed}ms | 점수:${score.total}/100 | ${costStr} | ${tokStr}`);
      }

      // Rate limit safety: small delay between models
      await new Promise(r => setTimeout(r, 1000));
    }

    // Cleanup uploaded file
    await deleteFile(uploadedFile.name);
    console.log();
  }

  // ── Summary table ──────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  종합 결과");
  console.log("═══════════════════════════════════════════════\n");

  // Aggregate by model
  const modelStats = {};
  for (const r of results) {
    if (!modelStats[r.model]) {
      modelStats[r.model] = { times: [], scores: [], costs: [], errors: 0, total: 0, modelDef: r.modelDef };
    }
    const s = modelStats[r.model];
    s.total++;
    if (r.error) { s.errors++; continue; }
    s.times.push(r.elapsed);
    s.scores.push(r.score.total);
    if (r.cost) s.costs.push(r.cost.cost);
  }

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  console.log("모델                          | 평균속도   | 평균점수 | 평균비용/클립  | 에러 | 가격(in/out)");
  console.log("------------------------------|----------|---------|-------------|------|-------------");

  const sortedModels = Object.entries(modelStats).sort((a, b) => {
    return (a[1].modelDef?.priceIn || 0) - (b[1].modelDef?.priceIn || 0);
  });

  for (const [model, stats] of sortedModels) {
    const avgTime = stats.times.length ? `${Math.round(avg(stats.times))}ms` : "N/A";
    const avgScore = stats.scores.length ? `${Math.round(avg(stats.scores))}/100` : "N/A";
    const avgCost = stats.costs.length ? `$${avg(stats.costs).toFixed(6)}` : "N/A";
    const priceStr = stats.modelDef
      ? `$${stats.modelDef.priceIn}/$${stats.modelDef.priceOut}`
      : "N/A";
    console.log(
      `${model.padEnd(30)}| ${avgTime.padEnd(9)}| ${avgScore.padEnd(8)}| ${avgCost.padEnd(12)}| ${stats.errors}/${stats.total}  | ${priceStr}`
    );
  }

  // ── 20개 전체 클립 비용 추정 ───────────────────────────────
  console.log("\n── 20개 전체 클립 예상 비용 ──\n");
  for (const [model, stats] of sortedModels) {
    if (!stats.costs.length) { console.log(`${model.padEnd(30)} — 비용 추정 불가 (에러)`); continue; }
    const perClip = avg(stats.costs);
    const total20 = perClip * 20;
    console.log(`${model.padEnd(30)} ${(perClip * 1000).toFixed(3)}¢/클립 × 20 = $${total20.toFixed(4)}`);
  }

  // Save detailed results
  const outputPath = path.join(PROJECT_ROOT, "config/gemini-benchmark-results.json");
  const output = {
    timestamp: new Date().toISOString(),
    sampleIds: SAMPLE_IDS,
    models: MODELS.map(m => m.id),
    results: results.map(r => ({
      clipId: r.clipId,
      model: r.model,
      elapsed: r.elapsed,
      error: r.error,
      score: r.score,
      cost: r.cost,
      tokenUsage: r.tokenUsage,
      parsed: r.parsed,
    })),
    summary: Object.fromEntries(sortedModels.map(([model, stats]) => [model, {
      avgTime: Math.round(avg(stats.times)),
      avgScore: Math.round(avg(stats.scores)),
      avgCostPerClip: stats.costs.length ? avg(stats.costs) : null,
      errorRate: stats.errors / stats.total,
    }])),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 상세 결과: ${outputPath}`);

  // ── 추천 ──────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  추천");
  console.log("═══════════════════════════════════════════════\n");

  // Find best value (score/cost ratio)
  const viable = sortedModels.filter(([, s]) => s.scores.length > 0 && s.costs.length > 0);
  if (viable.length) {
    const best = viable.reduce((best, curr) => {
      const bRatio = avg(best[1].scores) / (avg(best[1].costs) || 0.000001);
      const cRatio = avg(curr[1].scores) / (avg(curr[1].costs) || 0.000001);
      return cRatio > bRatio ? curr : best;
    });
    console.log(`🏆 가성비 최고: ${best[0]}`);
    console.log(`   점수: ${Math.round(avg(best[1].scores))}/100, 비용: $${avg(best[1].costs).toFixed(6)}/클립\n`);

    const highest = viable.reduce((best, curr) =>
      avg(curr[1].scores) > avg(best[1].scores) ? curr : best
    );
    console.log(`🎯 품질 최고: ${highest[0]}`);
    console.log(`   점수: ${Math.round(avg(highest[1].scores))}/100, 비용: $${avg(highest[1].costs).toFixed(6)}/클립\n`);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
