import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const policyPath = path.join(projectRoot, "src", "data", "access-policy.json");
const outputDir = path.join(projectRoot, "output");
const outputPath = path.join(outputDir, "access-policy-preview.html");

const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBadge(value) {
  const normalized = String(value).toLowerCase();
  const tone =
    normalized === "yes"
      ? "yes"
      : normalized === "no"
        ? "no"
        : normalized.includes("5")
          ? "limited"
          : normalized.includes("limited")
            ? "limited"
            : "neutral";

  return `<span class="badge ${tone}">${escapeHtml(value)}</span>`;
}

const rowsHtml = policy.capabilities
  .map(
    (item) => `
      <tr>
        <th scope="row">
          <div class="row-label">${escapeHtml(item.label)}</div>
          <div class="row-note">${escapeHtml(item.notes)}</div>
        </th>
        <td>${renderBadge(item.guest)}</td>
        <td>${renderBadge(item.free)}</td>
        <td>${renderBadge(item.pro)}</td>
      </tr>
    `
  )
  .join("");

const tierCardsHtml = policy.tiers
  .map(
    (tier) => `
      <article class="tier-card">
        <div class="tier-eyebrow">${escapeHtml(tier.id)}</div>
        <h3>${escapeHtml(tier.label)}</h3>
        <p>${escapeHtml(tier.summary)}</p>
      </article>
    `
  )
  .join("");

const ownerDecisionsHtml = policy.meta.ownerDecisions
  .map((item) => `<li>${escapeHtml(item)}</li>`)
  .join("");

const freeFeaturesHtml = policy.recommendedCopy.freeFeatures
  .map((item) => `<li>${escapeHtml(item)}</li>`)
  .join("");

const proFeaturesHtml = policy.recommendedCopy.proFeatures
  .map((item) => `<li>${escapeHtml(item)}</li>`)
  .join("");

const removeClaimsHtml = policy.recommendedCopy.removeClaims
  .map((item) => `<li>${escapeHtml(item)}</li>`)
  .join("");

const cautionClaimsHtml = policy.recommendedCopy.cautionClaims
  .map((item) => `<li>${escapeHtml(item)}</li>`)
  .join("");

const prioritiesHtml = policy.priorities
  .map(
    (item) => `
      <article class="priority-card">
        <div class="priority-pill">${escapeHtml(item.priority)}</div>
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.detail)}</p>
      </article>
    `
  )
  .join("");

const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(policy.meta.title)} Preview</title>
    <style>
      :root {
        --bg: #f3efe7;
        --surface: rgba(255, 255, 255, 0.8);
        --surface-strong: #fffdf8;
        --border: rgba(32, 27, 20, 0.12);
        --text: #241c15;
        --muted: #6c6258;
        --accent: #0f766e;
        --accent-soft: rgba(15, 118, 110, 0.12);
        --warning: #b45309;
        --warning-soft: rgba(180, 83, 9, 0.12);
        --danger: #b91c1c;
        --danger-soft: rgba(185, 28, 28, 0.12);
        --shadow: 0 24px 60px rgba(36, 28, 21, 0.08);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Pretendard", "Noto Sans KR", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.14), transparent 30%),
          radial-gradient(circle at top right, rgba(180, 83, 9, 0.12), transparent 28%),
          linear-gradient(180deg, #f7f3eb 0%, var(--bg) 100%);
      }

      .page {
        width: min(1180px, calc(100% - 40px));
        margin: 0 auto;
        padding: 48px 0 64px;
      }

      .hero {
        padding: 40px;
        border: 1px solid var(--border);
        border-radius: 28px;
        background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,250,242,0.72));
        box-shadow: var(--shadow);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 16px 0 12px;
        font-size: clamp(34px, 5vw, 56px);
        line-height: 1.02;
        letter-spacing: -0.04em;
      }

      .hero p {
        max-width: 780px;
        margin: 0;
        font-size: 17px;
        line-height: 1.7;
        color: var(--muted);
      }

      .section {
        margin-top: 28px;
        padding: 32px;
        border: 1px solid var(--border);
        border-radius: 24px;
        background: var(--surface);
        backdrop-filter: blur(14px);
        box-shadow: var(--shadow);
      }

      .section h2 {
        margin: 0 0 14px;
        font-size: 26px;
        letter-spacing: -0.03em;
      }

      .section-intro {
        margin: 0 0 20px;
        color: var(--muted);
        line-height: 1.7;
      }

      .grid {
        display: grid;
        gap: 16px;
      }

      .grid.tiers {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .grid.copy {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .tier-card,
      .copy-card,
      .note-card,
      .priority-card {
        padding: 20px;
        border-radius: 20px;
        border: 1px solid var(--border);
        background: var(--surface-strong);
      }

      .tier-eyebrow,
      .copy-eyebrow {
        margin-bottom: 10px;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }

      .tier-card h3,
      .copy-card h3,
      .priority-card h4 {
        margin: 0 0 8px;
        font-size: 22px;
        letter-spacing: -0.03em;
      }

      .tier-card p,
      .copy-card p,
      .priority-card p,
      .note-card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
      }

      .stack {
        display: grid;
        gap: 12px;
      }

      ul {
        margin: 12px 0 0;
        padding-left: 20px;
        color: var(--text);
        line-height: 1.7;
      }

      .decision-list {
        margin-top: 18px;
      }

      .matrix-wrap {
        overflow-x: auto;
        border-radius: 20px;
        border: 1px solid var(--border);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 760px;
        background: var(--surface-strong);
      }

      thead th {
        padding: 16px;
        text-align: left;
        font-size: 13px;
        color: var(--muted);
        background: rgba(36, 28, 21, 0.03);
      }

      tbody th,
      tbody td {
        padding: 16px;
        vertical-align: top;
        border-top: 1px solid var(--border);
      }

      .row-label {
        font-weight: 700;
      }

      .row-note {
        margin-top: 6px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 96px;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 700;
      }

      .badge.yes {
        background: var(--accent-soft);
        color: var(--accent);
      }

      .badge.no {
        background: var(--danger-soft);
        color: var(--danger);
      }

      .badge.limited {
        background: var(--warning-soft);
        color: var(--warning);
      }

      .badge.neutral {
        background: rgba(36, 28, 21, 0.06);
        color: var(--text);
      }

      .priority-pill {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(36, 28, 21, 0.06);
        color: var(--text);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .footer {
        margin-top: 22px;
        color: var(--muted);
        font-size: 14px;
      }

      @media (max-width: 900px) {
        .grid.tiers,
        .grid.copy {
          grid-template-columns: 1fr;
        }

        .page {
          width: min(100% - 24px, 1180px);
          padding-top: 24px;
        }

        .hero,
        .section {
          padding: 22px;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="eyebrow">Source of Truth</div>
        <h1>Free / Pro 진실표 프리뷰</h1>
        <p>
          이 프리뷰는 문구가 아니라 현재 코드 기준의 실제 동작을 한 곳에 모아 보여줍니다.
          사용자가 확정한 기준은 "현재 코드가 진실의 원천", "로그인한 사람은 free, 구독자만 pro",
          "상세 페이지는 비로그인도 공개"입니다.
        </p>
        <ul class="decision-list">
          ${ownerDecisionsHtml}
        </ul>
      </section>

      <section class="section">
        <h2>Tier 정의</h2>
        <p class="section-intro">
          앱 안에서는 auth tier가 free/pro 두 단계지만, 제품 설명에서는 guest를 따로 보여줘야
          비로그인 상태와 로그인 무료 상태를 구분하기 쉽습니다.
        </p>
        <div class="grid tiers">
          ${tierCardsHtml}
        </div>
      </section>

      <section class="section">
        <h2>현재 코드 기준 기능 표</h2>
        <p class="section-intro">
          아래 표가 앞으로 Free / Pro 논의의 기준표입니다. 숫자와 잠금 조건도 여기에 맞춥니다.
        </p>
        <div class="matrix-wrap">
          <table>
            <thead>
              <tr>
                <th>기능</th>
                <th>Guest</th>
                <th>Free</th>
                <th>Pro</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <h2>추천 문구 초안</h2>
        <p class="section-intro">
          현재 코드와 맞는 문구만 남기고, 아직 구현되지 않았거나 실제 동작과 다른 숫자는 전면에서 뺍니다.
        </p>
        <div class="grid copy">
          <article class="copy-card">
            <div class="copy-eyebrow">Hero / Free</div>
            <h3>${escapeHtml(policy.recommendedCopy.heroSub)}</h3>
            <p>${escapeHtml(policy.recommendedCopy.freeDescription)}</p>
            <ul>${freeFeaturesHtml}</ul>
          </article>
          <article class="copy-card">
            <div class="copy-eyebrow">Pro</div>
            <h3>${escapeHtml(policy.recommendedCopy.proDescription)}</h3>
            <p>지금 코드에서 실제로 Pro가 풀어주는 혜택만 적었습니다.</p>
            <ul>${proFeaturesHtml}</ul>
          </article>
        </div>
        <div class="grid copy" style="margin-top: 16px;">
          <article class="note-card">
            <div class="copy-eyebrow">제거 권장</div>
            <ul>${removeClaimsHtml}</ul>
          </article>
          <article class="note-card">
            <div class="copy-eyebrow">주의 권장</div>
            <ul>${cautionClaimsHtml}</ul>
          </article>
        </div>
      </section>

      <section class="section">
        <h2>우선순위</h2>
        <p class="section-intro">
          당장 혼선을 줄이는 순서대로 정리했습니다. 문구 정렬과 기준 중앙화가 먼저입니다.
        </p>
        <div class="stack">
          ${prioritiesHtml}
        </div>
      </section>

      <p class="footer">
        Last updated: ${escapeHtml(policy.meta.lastUpdated)} · Truth source: ${escapeHtml(policy.meta.truthSourceLabel)}
      </p>
    </main>
  </body>
</html>
`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, html, "utf8");

console.log(`Wrote ${outputPath}`);
