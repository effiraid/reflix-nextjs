# Security Best Practices Report

## Executive Summary

Reflix의 현재 공격 표면은 대부분 `media.reflix.dev` 보호 계층에 집중되어 있습니다. 가장 큰 문제는 미디어 세션 쿠키를 `.reflix.dev` 전체에 배포하면서 Worker가 `*.reflix.dev` 전체와 `localhost`까지 신뢰한다는 점입니다. 이 조합 때문에 서브도메인 탈취, 서브도메인 XSS, 로컬 웹서버 악용만으로도 보호된 mp4를 스크립트로 읽어낼 수 있습니다.

또한 Worker는 `Origin`/`Referer`가 모두 없는 요청을 명시적으로 허용합니다. 이 동작은 브라우저의 referrer 정책을 악용한 서드파티 임베드와 핫링킹을 다시 열어 줍니다. 현재 보호 레이어는 “직접 URL 접근을 조금 어렵게 만드는 수준”이며, 공격자 관점에서는 신뢰 경계가 너무 넓습니다.

## High Severity

### S-001

- Rule ID: NEXT-CORS-TRUST-001
- Severity: High
- Location: `workers/media-gateway/src/index.ts` `isAllowedOrigin()` / `corsHeaders()` / request gate, `src/proxy.ts` `withMediaSession()`
- Evidence:
  - `workers/media-gateway/src/index.ts:48` trusts `reflix.dev` and every `*.reflix.dev` hostname.
  - `workers/media-gateway/src/index.ts:83` reflects the caller's `Origin` into `Access-Control-Allow-Origin`.
  - `workers/media-gateway/src/index.ts:84` enables `Access-Control-Allow-Credentials: true`.
  - `src/proxy.ts:33` sets the media session cookie as `SameSite=None`.
  - `src/proxy.ts:34` scopes the cookie to `MEDIA_SESSION_COOKIE_DOMAIN`, and the documented production value is `.reflix.dev`.
- Impact: Any compromised or taken-over sibling origin such as `foo.reflix.dev` can run JavaScript that fetches `https://media.reflix.dev/videos/...` with credentials and read the response body. That collapses the entire media protection boundary to “every subdomain under the zone must be perfectly trusted forever.”
- Fix: Replace the wildcard hostname trust with an explicit allowlist of exact origins. In practice this should usually be only `https://reflix.dev` plus a tightly controlled preview/staging list from `ALLOWED_ORIGINS`.
- Mitigation: Reduce cookie scope if possible, and treat every temporary preview/staging domain as production-sensitive until this wildcard trust is removed.
- False positive notes: This finding assumes at least one sibling subdomain can be compromised, misconfigured, or taken over over time. In real estates with many subdomains, that is a realistic assumption.

### S-002

- Rule ID: NEXT-ACCESS-CONTROL-002
- Severity: High
- Location: `workers/media-gateway/src/index.ts` request validation path, `workers/media-gateway/src/index.test.ts`, `docs/superpowers/specs/2026-03-26-clip-sharing-design.md`
- Evidence:
  - `workers/media-gateway/src/index.ts:140` only blocks requests when a parsed hostname exists and is disallowed.
  - `workers/media-gateway/src/index.ts:172` falls back to cookie-only authorization for protected media.
  - `workers/media-gateway/src/index.test.ts:200` explicitly tests that requests with neither `Origin` nor `Referer` succeed.
  - `docs/superpowers/specs/2026-03-26-clip-sharing-design.md:65` documents the same “allow when both headers are missing” behavior.
- Impact: A third-party site can suppress `Referer` with `Referrer-Policy: no-referrer` and embed protected videos as ordinary media subresources. Because the cookie is `SameSite=None`, the victim browser will still attach it, so the Worker will serve the protected asset even though the request did not originate from Reflix.
- Fix: Fail closed when both `Origin` and `Referer` are absent for protected paths, or replace header-based gating with a stronger per-request proof such as signed URLs or short-lived clip-scoped tokens bound to the first-party app.
- Mitigation: If headerless requests must remain supported temporarily, at least restrict them to narrowly defined user agents or flows and add anomaly logging so hotlinking attempts are visible.
- False positive notes: The exploitability depends on browser behavior around media subresource headers, but the current code and tests intentionally accept the exact headerless case an attacker would target.

## Medium Severity

### S-003

- Rule ID: NEXT-CORS-TRUST-003
- Severity: Medium
- Location: `workers/media-gateway/src/index.ts` `isAllowedOrigin()` / `corsHeaders()`, `src/proxy.ts` cookie options
- Evidence:
  - `workers/media-gateway/src/index.ts:51` and `workers/media-gateway/src/index.ts:52` permanently trust `localhost` and `127.0.0.1`.
  - `workers/media-gateway/src/index.ts:83` reflects any accepted origin into CORS.
  - `src/proxy.ts:33` sets `SameSite=None`, allowing cross-site credentialed requests.
- Impact: Any page running on a victim's local web server can read protected media from `media.reflix.dev` as long as the victim has a valid media session cookie. This turns arbitrary local tools, Electron apps, browser extensions exposing localhost UIs, or malware-assisted local listeners into trusted readers of your protected media.
- Fix: Remove localhost trust from production code and allow it only in explicit development environments or via env-configured exact origins.
- Mitigation: Split dev and prod worker configs so the production Worker never ships localhost in its allowlist.
- False positive notes: This is lower severity than S-001 because it requires a malicious or compromised local origin, but trusting localhost in production is still an unnecessary expansion of the attack surface.

## Residual Risks And Gaps

- I did not find app-code evidence of a global CSP, `frame-ancestors`, or `X-Frame-Options`. If those are enforced at Vercel/Cloudflare, verify them there; they are not visible in this repository.
- I did not review external Cloudflare or Vercel runtime configuration, so any edge-side rate limits, WAF rules, or header policies may change the practical risk.
