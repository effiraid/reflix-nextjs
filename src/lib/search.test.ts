import { describe, expect, it } from "vitest";
import { matchesKorean, matchesEnglish } from "./search";

describe("matchesKorean", () => {
  it("일반 includes 매칭", () => {
    expect(matchesKorean("마법", "마법 공격")).toBe(true);
    expect(matchesKorean("공격", "마법 공격")).toBe(true);
    expect(matchesKorean("회복", "마법 공격")).toBe(false);
  });

  it("초성 검색", () => {
    expect(matchesKorean("ㅁㅂ", "마법")).toBe(true);
    expect(matchesKorean("ㄱ", "검")).toBe(true);
    expect(matchesKorean("ㄱㅃ", "기쁨")).toBe(true);
    expect(matchesKorean("ㅎㅂ", "마법")).toBe(false);
  });

  it("영타→한글 변환", () => {
    // "akfRkd" → QWERTY 키보드로 "마법" 입력
    expect(matchesKorean("akqjq", "마법")).toBe(true);
    // "rja" → QWERTY 키보드로 "검" 입력
    expect(matchesKorean("rja", "검")).toBe(true);
  });

  it("대소문자 무관", () => {
    expect(matchesKorean("Magic", "Magic Attack")).toBe(true);
    expect(matchesKorean("magic", "Magic Attack")).toBe(true);
  });
});

describe("matchesEnglish", () => {
  it("정확한 매칭", () => {
    expect(matchesEnglish("Sword", "Sword")).toBe(true);
    expect(matchesEnglish("sword", "Sword")).toBe(true);
  });

  it("부분 매칭", () => {
    expect(matchesEnglish("mag", "Magic")).toBe(true);
    expect(matchesEnglish("war", "Warrior")).toBe(true);
  });

  it("오타 허용 (fuzzy)", () => {
    expect(matchesEnglish("magc", "Magic")).toBe(true);
    expect(matchesEnglish("warior", "Warrior")).toBe(true);
    expect(matchesEnglish("swrd", "Sword")).toBe(true);
  });

  it("전혀 다른 단어는 불일치", () => {
    expect(matchesEnglish("fire", "Sword")).toBe(false);
    expect(matchesEnglish("xyz", "Magic")).toBe(false);
  });
});
