import { useEffect } from "react";
import { isTypingTarget } from "@/hooks/useKeyboardShortcuts";

interface UseVideoKeyboardOptions {
  togglePlayback: () => void;
  seekRelative: (seconds: number) => void;
  toggleMute: () => void;
  resetMarkers: () => void;
  toggleFullscreen: () => void;
  setInPointHere: () => void;
  setOutPointHere: () => void;
  toggleLoop: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  stepSpeed: (direction: 1 | -1) => void;
  onExpandToggle?: () => void;
  disabled?: boolean;
}

function isNestedInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return !!target.closest("button, a[href], [role='slider']");
}

export function useVideoKeyboard({
  togglePlayback,
  seekRelative,
  toggleMute,
  resetMarkers,
  toggleFullscreen,
  setInPointHere,
  setOutPointHere,
  toggleLoop,
  stepForward,
  stepBackward,
  stepSpeed,
  onExpandToggle,
  disabled = false,
}: UseVideoKeyboardOptions) {
  useEffect(() => {
    if (disabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      if (isNestedInteractiveTarget(e.target)) return;

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
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "i":
        case "I":
        case "[":
          e.preventDefault();
          setInPointHere();
          break;
        case "o":
        case "O":
        case "]":
          e.preventDefault();
          setOutPointHere();
          break;
        case "l":
        case "L":
          e.preventDefault();
          toggleLoop();
          break;
        case ",":
        case "<":
          e.preventDefault();
          stepBackward();
          break;
        case ".":
        case ">":
          e.preventDefault();
          stepForward();
          break;
        case "-":
          e.preventDefault();
          stepSpeed(-1);
          break;
        case "+":
        case "=":
          e.preventDefault();
          stepSpeed(1);
          break;
        case "e":
        case "E":
          if (onExpandToggle) {
            e.preventDefault();
            onExpandToggle();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, togglePlayback, seekRelative, toggleMute, resetMarkers, toggleFullscreen, setInPointHere, setOutPointHere, toggleLoop, stepForward, stepBackward, stepSpeed, onExpandToggle]);
}
