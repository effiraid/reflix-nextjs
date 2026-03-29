import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountClient } from "./AccountClient";
import { useAuthStore } from "@/stores/authStore";
import koDict from "@/app/[lang]/dictionaries/ko.json";
import type { Dictionary } from "@/app/[lang]/dictionaries";

const {
  routerReplaceMock,
  routerPushMock,
  getUserIdentitiesMock,
  linkIdentityMock,
  searchParamsState,
} =
  vi.hoisted(() => ({
    routerReplaceMock: vi.fn(),
    routerPushMock: vi.fn(),
    getUserIdentitiesMock: vi.fn(),
    linkIdentityMock: vi.fn(),
    searchParamsState: {
      value: "",
    },
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
    push: routerPushMock,
  }),
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
  usePathname: () => "/ko/account",
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
      signOut: vi.fn().mockResolvedValue({}),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { display_name: "test" }, error: null }),
        }),
      }),
    }),
  }),
}));

const dict = {
  auth: koDict.auth,
  account: koDict.account,
} satisfies Pick<Dictionary, "auth" | "account">;

describe("AccountClient", () => {
  beforeEach(() => {
    routerReplaceMock.mockReset();
    routerPushMock.mockReset();
    getUserIdentitiesMock.mockReset();
    linkIdentityMock.mockReset();

    useAuthStore.setState({
      user: {
        id: "user-1",
        email: "user@example.com",
      } as never,
      tier: "free",
      planTier: "free",
      accessSource: "free",
      betaEndsAt: null,
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

  it("renders tab navigation with 4 tabs", async () => {
    render(<AccountClient lang="ko" dict={dict} />);

    expect(screen.getByRole("tab", { name: "프로필" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "구독" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "보안" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "설정" })).not.toBeInTheDocument();
  });

  it("defaults to profile tab and shows nickname field", async () => {
    render(<AccountClient lang="ko" dict={dict} />);

    expect(await screen.findByPlaceholderText("닉네임을 입력하세요")).toBeInTheDocument();
  });

  it("shows security tab with Connect Google button", async () => {
    searchParamsState.value = "tab=security";
    render(<AccountClient lang="ko" dict={dict} />);

    expect(
      await screen.findByRole("button", { name: "Google 연결" })
    ).toBeInTheDocument();
  });

  it("shows Connected when Google is already linked on security tab", async () => {
    getUserIdentitiesMock.mockResolvedValue({
      data: {
        identities: [
          { provider: "email", identity_id: "email-1" },
          { provider: "google", identity_id: "google-1" },
        ],
      },
      error: null,
    });
    searchParamsState.value = "tab=security&linked=google";

    render(<AccountClient lang="ko" dict={dict} />);

    expect(await screen.findByText("연결됨")).toBeInTheDocument();
    expect(
      screen.getByText("Google 연결이 완료되었습니다.")
    ).toBeInTheDocument();
  });

  it("shows subscription tab with beta status", async () => {
    useAuthStore.setState({
      user: { id: "user-1", email: "user@example.com" } as never,
      tier: "pro",
      planTier: "free",
      accessSource: "beta",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
      isLoading: false,
    });
    searchParamsState.value = "tab=subscription";

    render(<AccountClient lang="ko" dict={dict} />);

    expect(await screen.findByText("Pro 체험 중")).toBeInTheDocument();
    expect(
      screen.getByText("종료 후 무료 티어로 전환됩니다.")
    ).toBeInTheDocument();
  });

  it("starts Google linking with security tab return URL", async () => {
    searchParamsState.value = "tab=security";
    render(<AccountClient lang="ko" dict={dict} />);

    fireEvent.click(await screen.findByRole("button", { name: "Google 연결" }));

    await waitFor(() => {
      expect(linkIdentityMock).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo:
            "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Ftab%3Dsecurity%26linked%3Dgoogle",
        },
      });
    });
  });
});
