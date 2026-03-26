import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Watermark } from "./Watermark";

describe("Watermark", () => {
  it("renders reflix.dev text", () => {
    render(<Watermark />);
    expect(screen.getByText("reflix.dev")).toBeInTheDocument();
  });

  it("is hidden from screen readers", () => {
    render(<Watermark />);
    expect(screen.getByText("reflix.dev").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("is not interactive", () => {
    render(<Watermark />);
    const el = screen.getByText("reflix.dev").closest("[aria-hidden]") as HTMLElement;
    expect(el.className).toContain("pointer-events-none");
    expect(el.className).toContain("select-none");
  });

  it("uses small size styling by default", () => {
    render(<Watermark />);
    const span = screen.getByText("reflix.dev");
    expect(span.className).toContain("text-[10px]");
  });

  it("uses medium size styling when specified", () => {
    render(<Watermark size="md" />);
    const span = screen.getByText("reflix.dev");
    expect(span.className).toContain("text-[11px]");
  });
});
