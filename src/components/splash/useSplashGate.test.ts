import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSplashGate } from "./useSplashGate";

describe("useSplashGate", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("intro mode", () => {
    it("returns shouldShow=true on first visit", () => {
      const { result } = renderHook(() => useSplashGate("intro"));
      expect(result.current.shouldShow).toBe(true);
    });

    it("returns shouldShow=false on return visit", () => {
      localStorage.setItem("reflix-visited", "1");
      const { result } = renderHook(() => useSplashGate("intro"));
      expect(result.current.shouldShow).toBe(false);
    });

    it("markComplete writes to localStorage", () => {
      const { result } = renderHook(() => useSplashGate("intro"));
      act(() => result.current.markComplete());
      expect(localStorage.getItem("reflix-visited")).toBe("1");
    });
  });

  describe("auth mode", () => {
    it("returns shouldShow=true always", () => {
      localStorage.setItem("reflix-visited", "1");
      const { result } = renderHook(() => useSplashGate("auth"));
      expect(result.current.shouldShow).toBe(true);
    });

    it("markComplete does not write to localStorage", () => {
      const { result } = renderHook(() => useSplashGate("auth"));
      act(() => result.current.markComplete());
      expect(localStorage.getItem("reflix-visited")).toBeNull();
    });
  });

  describe("storage unavailable", () => {
    it("returns shouldShow=true when localStorage throws", () => {
      const spy = vi
        .spyOn(Storage.prototype, "getItem")
        .mockImplementation(() => {
          throw new Error("SecurityError");
        });

      const { result } = renderHook(() => useSplashGate("intro"));
      expect(result.current.shouldShow).toBe(true);

      spy.mockRestore();
    });

    it("markComplete does not throw when localStorage throws", () => {
      const spy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("QuotaExceeded");
        });

      const { result } = renderHook(() => useSplashGate("intro"));
      expect(() => act(() => result.current.markComplete())).not.toThrow();

      spy.mockRestore();
    });
  });
});
