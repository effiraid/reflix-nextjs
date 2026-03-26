import { getChoseong, convertQwertyToHangul } from "es-hangul";
import { fuzzyMatch } from "@nozbe/microfuzz";

/** 쿼리가 순수 초성(ㄱ-ㅎ)으로만 구성되어 있는지 확인 */
export function isChoseongOnly(str: string): boolean {
  return /^[ㄱ-ㅎ]+$/.test(str);
}

/** 쿼리가 영문 알파벳으로만 구성되어 있는지 확인 (영타 변환 대상) */
export function isLatinOnly(str: string): boolean {
  return /^[a-zA-Z]+$/.test(str);
}

/**
 * 한글 검색 매칭 — 초성 검색 + 영타→한글 변환 지원
 *
 * 매칭 순서:
 * 1. 일반 includes 매칭 (기본)
 * 2. 초성 매칭: 쿼리가 초성만일 때 (예: "ㄱㅃ" → "기쁨")
 * 3. 영타 변환: 쿼리가 영문일 때 한글로 변환 후 재매칭 (예: "akfRkd" → "마법")
 */
export function matchesKorean(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // 1. 일반 매칭
  if (t.includes(q)) return true;

  // 2. 초성 매칭
  if (isChoseongOnly(query)) {
    const targetChoseong = getChoseong(target);
    if (targetChoseong.includes(query)) return true;
  }

  // 3. 영타→한글 변환
  if (isLatinOnly(query)) {
    try {
      const converted = convertQwertyToHangul(query);
      if (t.includes(converted.toLowerCase())) return true;
      // 변환 결과가 초성이면 초성 매칭도 시도
      if (isChoseongOnly(converted)) {
        const targetChoseong = getChoseong(target);
        if (targetChoseong.includes(converted)) return true;
      }
    } catch {
      // 변환 실패 시 무시
    }
  }

  return false;
}

/**
 * 영어 퍼지 매칭 — 오타 허용 검색 (microfuzz)
 *
 * "magc" → "Magic" 매칭, "swrod" → "Sword" 매칭 등
 */
export function matchesEnglish(query: string, target: string): boolean {
  return fuzzyMatch(target, query) !== null;
}

/** Lang-aware matcher factory — eliminates repeated lang ternary */
export function createMatcher(
  lang: "ko" | "en",
  query: string
): (target: string) => boolean {
  return lang === "ko"
    ? (target) => matchesKorean(query, target)
    : (target) => matchesEnglish(query, target);
}
