import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountClient } from "./AccountClient";
import { useAuthStore } from "@/stores/authStore";
import type { Dictionary } from "@/app/[lang]/dictionaries";

const {
  routerReplaceMock,
  getUserIdentitiesMock,
  linkIdentityMock,
  searchParamsState,
} =
  vi.hoisted(() => ({
    routerReplaceMock: vi.fn(),
    getUserIdentitiesMock: vi.fn(),
    linkIdentityMock: vi.fn(),
    searchParamsState: {
      value: "",
    },
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUserIdentities: getUserIdentitiesMock,
      linkIdentity: linkIdentityMock,
    },
  }),
}));

const dict = {} as Dictionary;

describe("AccountClient", () => {
  beforeEach(() => {
    routerReplaceMock.mockReset();
    getUserIdentitiesMock.mockReset();
    linkIdentityMock.mockReset();

    useAuthStore.setState({
      user: {
        id: "user-1",
        email: "user@example.com",
      } as never,
      tier: "free",
      isLoading: false,
    });

    getUserIdentitiesMock.mockResolvedValue({
      data: {
        identities: [{ provider: "email", identity_id: "email-1" }],
      },
      error: null,
    });

    linkIdentityMock.mockResolvedValue({
      data: {
        provider: "google",
        url: "https://accounts.google.com",
      },
      error: null,
    });
    searchParamsState.value = "";
  });

  it("shows a Connect Google button when Google is not linked", async () => {
    render(<AccountClient lang="ko" dict={dict} />);

    expect(
      await screen.findByRole("button", { name: "Google 연결" })
    ).toBeInTheDocument();
  });

  it("shows Connected when Google is already linked", async () => {
    getUserIdentitiesMock.mockResolvedValue({
      data: {
        identities: [
          { provider: "email", identity_id: "email-1" },
          { provider: "google", identity_id: "google-1" },
        ],
      },
      error: null,
    });
    searchParamsState.value = "linked=google";

    render(<AccountClient lang="ko" dict={dict} />);

    expect(await screen.findByText("연결됨")).toBeInTheDocument();
    expect(
      screen.getByText("Google 연결이 완료되었습니다.")
    ).toBeInTheDocument();
  });

  it("starts manual Google linking with an account return URL", async () => {
    render(<AccountClient lang="ko" dict={dict} />);

    fireEvent.click(await screen.findByRole("button", { name: "Google 연결" }));

    await waitFor(() => {
      expect(linkIdentityMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle",
        },
      });
    });
  });

  it("shows an inline error when identities fail to load", async () => {
    getUserIdentitiesMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    searchParamsState.value = "linkError=google";

    render(<AccountClient lang="ko" dict={dict} />);

    expect(
      await screen.findByText("Google 연결을 완료하지 못했습니다. 다시 시도해주세요.")
    ).toBeInTheDocument();
  });
});
