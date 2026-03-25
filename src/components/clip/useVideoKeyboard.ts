import { useEffect } from "react";

interface UseVideoKeyboardOptions {
  togglePlayback: () => void;
  seekRelative: (seconds: number) => void;
  toggleMute: () => void;
  resetMarkers: () => void;
  disabled?: boolean;
}

export function useVideoKeyboard({
  togglePlayback,
  seekRelative,
  toggleMute,
  resetMarkers,
  disabled = false,
}: UseVideoKeyboardOptions) {
  useEffect(() => {
    if (disabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlayback();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekRelative(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekRelative(1);
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "x":
        case "X":
          e.preventDefault();
          resetMarkers();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, togglePlayback, seekRelative, toggleMute, resetMarkers]);
}
