import fs from "node:fs";
import path from "node:path";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

function uniqStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    )
  );
}

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getResponseText(payload) {
  return (payload?.candidates ?? [])
    .flatMap((candidate) => candidate?.content?.parts ?? [])
    .map((part) => part?.text)
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");
}

async function fetchJson(url, options, fetchImpl) {
  const response = await fetchImpl(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function getFileState(file) {
  const state = file?.state;

  if (typeof state === "string") {
    return state;
  }

  if (state && typeof state === "object" && typeof state.name === "string") {
    return state.name;
  }

  return "";
}

export function buildAiTagPrompt({ clipName, existingTags }) {
  const existingTagText = Array.isArray(existingTags) && existingTags.length > 0
    ? existingTags.join(", ")
    : "없음";

  return `당신은 게임 애니메이션 분석 전문가입니다. 이 짧은 게임 애니메이션 클립을 분석해주세요.

기존 수동 태그: ${existingTagText}
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

export function extractJsonObject(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini response did not contain text");
  }

  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch ? fencedMatch[1] : trimmed;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Gemini response did not contain a JSON object");
  }

  return JSON.parse(jsonMatch[0]);
}

export function normalizeAiTags(payload, { model, generatedAt }) {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI tag payload must be an object");
  }

  const description = {
    ko: toTrimmedString(payload?.description?.ko),
    en: toTrimmedString(payload?.description?.en),
  };

  if (!description.ko || !description.en) {
    throw new Error("AI tag payload must include description.ko and description.en");
  }

  const pacing = toTrimmedString(payload.pacing);
  if (!pacing) {
    throw new Error("AI tag payload must include pacing");
  }

  return {
    actionType: uniqStrings(payload.actionType),
    emotion: uniqStrings(payload.emotion),
    composition: uniqStrings(payload.composition),
    pacing,
    characterType: uniqStrings(payload.characterType),
    effects: uniqStrings(payload.effects),
    description,
    model: toTrimmedString(model),
    generatedAt: toTrimmedString(generatedAt),
  };
}

export async function uploadGeminiFile({
  apiKey,
  filePath,
  displayName = path.basename(filePath),
  mimeType = "video/mp4",
  fetchImpl = fetch,
  readFileSync = fs.readFileSync,
  statSync = fs.statSync,
  baseUrl = DEFAULT_GEMINI_BASE_URL,
}) {
  const fileBuffer = readFileSync(filePath);
  const fileStats = statSync(filePath);

  const startResponse = await fetchImpl(`${baseUrl}/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(fileStats.size),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: { display_name: displayName },
    }),
  });

  if (!startResponse.ok) {
    const text = await startResponse.text();
    throw new Error(text || `Failed to start Gemini file upload (${startResponse.status})`);
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("Gemini file upload did not return x-goog-upload-url");
  }

  const uploadResponse = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(fileStats.size),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: fileBuffer,
  });

  const uploadText = await uploadResponse.text();
  const uploadData = uploadText ? JSON.parse(uploadText) : {};

  if (!uploadResponse.ok) {
    const message =
      uploadData?.error?.message ||
      uploadData?.message ||
      `Failed to upload Gemini file (${uploadResponse.status})`;
    throw new Error(message);
  }

  return uploadData.file;
}

export async function waitForGeminiFileActive({
  apiKey,
  fileName,
  fetchImpl = fetch,
  baseUrl = DEFAULT_GEMINI_BASE_URL,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  pollMs = 5000,
  maxAttempts = 60,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = await fetchJson(
      `${baseUrl}/v1beta/${fileName}?key=${apiKey}`,
      { method: "GET" },
      fetchImpl
    );
    const file = data.file ?? data;
    const state = getFileState(file);

    if (state === "ACTIVE") {
      return file;
    }

    if (state === "FAILED") {
      const message = file?.error?.message || "Gemini file processing failed";
      throw new Error(message);
    }

    await wait(pollMs);
  }

  throw new Error(`Gemini file did not become ACTIVE after ${maxAttempts} checks`);
}

export async function deleteGeminiFile({
  apiKey,
  fileName,
  fetchImpl = fetch,
  baseUrl = DEFAULT_GEMINI_BASE_URL,
}) {
  const response = await fetchImpl(`${baseUrl}/v1beta/${fileName}?key=${apiKey}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to delete Gemini file (${response.status})`);
  }
}

export async function generateAiTagsWithGemini(clip, {
  apiKey = process.env.GEMINI_API_KEY,
  model = DEFAULT_GEMINI_MODEL,
  fetchImpl = fetch,
  baseUrl = DEFAULT_GEMINI_BASE_URL,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  pollMs = 5000,
  maxAttempts = 60,
} = {}) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required");
  }

  if (!clip?._mediaPath) {
    throw new Error(`Clip ${clip?.id || "unknown"} is missing _mediaPath`);
  }

  const uploadedFile = await uploadGeminiFile({
    apiKey,
    filePath: clip._mediaPath,
    displayName: clip.id || path.basename(clip._mediaPath),
    mimeType: "video/mp4",
    fetchImpl,
    baseUrl,
  });

  const fileName = uploadedFile?.name;
  if (!fileName) {
    throw new Error("Gemini upload did not return a file name");
  }

  try {
    const activeFile = await waitForGeminiFileActive({
      apiKey,
      fileName,
      fetchImpl,
      baseUrl,
      wait,
      pollMs,
      maxAttempts,
    });

    const response = await fetchJson(
      `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  file_data: {
                    mime_type: activeFile.mimeType || "video/mp4",
                    file_uri: activeFile.uri,
                  },
                },
                {
                  text: buildAiTagPrompt({
                    clipName: clip.name,
                    existingTags: clip.tags,
                  }),
                },
              ],
            },
          ],
        }),
      },
      fetchImpl
    );

    return normalizeAiTags(extractJsonObject(getResponseText(response)), {
      model,
      generatedAt: new Date().toISOString(),
    });
  } finally {
    try {
      await deleteGeminiFile({
        apiKey,
        fileName,
        fetchImpl,
        baseUrl,
      });
    } catch {
      // Best-effort cleanup only.
    }
  }
}
