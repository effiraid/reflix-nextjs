import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingModal } from "./PricingModal";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

const { routerPushMock } = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

describe("PricingModal", () => {
  beforeEach(() => {
    routerPushMock.mockReset();

    useUIStore.setState({
      pricingModalOpen: true,
      pricingModalIntent: null,
    });

    useAuthStore.setState({
      user: null,
      tier: "free",
      planTier: "free",
      accessSource: "free",
      betaEndsAt: null,
      isLoading: false,
    });
  });

  it("keeps the yearly savings note slot reserved in monthly mode so CTA buttons stay put", () => {
    render(<PricingModal lang="ko" />);

    expect(
      screen.queryByTestId("pricing-modal-pro-billing-note")
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("pricing-modal-pro-billing-spacer")
    ).toHaveStyle({ height: "18px" });

    fireEvent.click(screen.getByRole("button", { name: /연간/ }));

    expect(
      screen.getByTestId("pricing-modal-pro-billing-note")
    ).toHaveTextContent("₩8,250/월");
    expect(
      screen.queryByTestId("pricing-modal-pro-billing-spacer")
    ).not.toBeInTheDocument();
  });

  it("keeps hook order stable when the modal opens from a closed state", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    useUIStore.setState({
      pricingModalOpen: false,
    });

    render(<PricingModal lang="ko" />);

    act(() => {
      useUIStore.setState({
        pricingModalOpen: true,
      });
    });

    expect(screen.getByRole("dialog", { name: "요금제" })).toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("change in the order of Hooks")
    );

    consoleErrorSpy.mockRestore();
  });

  it("keeps the subscribe CTA enabled for beta users", () => {
    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "pro",
      planTier: "free",
      accessSource: "beta",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
      isLoading: false,
    });

    render(<PricingModal lang="ko" />);

    expect(
      screen.getByRole("button", { name: "구독 시작" })
    ).toBeEnabled();
  });

  it("prioritizes the Free login CTA for guests who clicked a locked result", () => {
    useUIStore.setState({
      pricingModalOpen: true,
      pricingModalIntent: {
        kind: "locked-clip",
        viewerTier: "guest",
        clipId: "clip-7",
        nextPath: "/ko/browse?q=arcane&resumeClip=clip-7&resumeOpen=1",
      },
    });

    render(<PricingModal lang="ko" />);

    expect(
      screen.getByRole("button", { name: "로그인해서 Free 시작" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "로그인해서 Free 시작" }));

    expect(routerPushMock).toHaveBeenCalledWith(
      "/ko/login?next=%2Fko%2Fbrowse%3Fq%3Darcane%26resumeClip%3Dclip-7%26resumeOpen%3D1"
    );
  });
});
