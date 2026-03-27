# Google Identity Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 사용자가 계정 페이지에서 Google 로그인 수단을 추가로 연결하고, OAuth 완료 후 탭 닫기 없이 자연스럽게 계정 페이지로 돌아오게 만든다.

**Architecture:** 기존 Supabase 브라우저 클라이언트와 `/[lang]/auth/callback` 페이지를 재사용하되, 콜백 URL에 안전한 `next` 경로를 포함할 수 있도록 리다이렉트 헬퍼를 확장한다. 계정 페이지는 전역 store를 늘리지 않고 로컬 상태로 linked identities를 읽고, Google 연결 버튼과 연결 상태를 표시한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Testing Library, Supabase Auth

---

## File Structure

- Modify: `src/lib/authRedirect.ts`
  - auth callback URL 생성 시 안전한 `next` 경로를 포함하도록 확장
- Modify: `src/lib/authRedirect.test.ts`
  - `next` 포함/차단 케이스 테스트 추가
- Create: `src/app/[lang]/auth/callback/page.test.tsx`
  - 성공 시 자동 리다이렉트, `window.close()` 미호출, 링크 실패 복귀 테스트
- Modify: `src/app/[lang]/auth/callback/page.tsx`
  - hash/session 처리 후 안전한 페이지로 자동 이동
- Create: `src/app/[lang]/account/AccountClient.test.tsx`
  - identities 조회, 연결 상태 표시, Google 연결 버튼 동작 테스트
- Modify: `src/app/[lang]/account/AccountClient.tsx`
  - linked identities 로딩, 성공/실패 배너, Google 연결 버튼 UI
- Modify: `src/app/[lang]/account/page.tsx`
  - 서버 `searchParams`를 client 컴포넌트로 전달

---

### Task 1: 리다이렉트 헬퍼와 콜백 페이지를 “자동 이동” 흐름으로 바꾸기

**Files:**
- Modify: `src/lib/authRedirect.ts`
- Modify: `src/lib/authRedirect.test.ts`
- Create: `src/app/[lang]/auth/callback/page.test.tsx`
- Modify: `src/app/[lang]/auth/callback/page.tsx`

- [ ] **Step 1: `authRedirect` 실패 테스트 먼저 추가**

`src/lib/authRedirect.test.ts`에 아래 테스트를 추가한다.

```ts
it("adds a safe next param to auth callback URLs", () => {
  expect(
    buildAuthCallbackUrl(
      "ko",
      "http://localhost:3000",
      "/ko/account?linked=google"
    )
  ).toBe(
    "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle"
  );
});

it("falls back to the locale browse path when next is unsafe", () => {
  expect(
    buildAuthCallbackUrl("en", "http://localhost:3000", "https://evil.example")
  ).toBe("http://localhost:3000/en/auth/callback?next=%2Fen%2Fbrowse");
});
```

- [ ] **Step 2: 헬퍼 테스트가 실제로 실패하는지 확인**

Run: `npx vitest run src/lib/authRedirect.test.ts`
Expected: FAIL because `buildAuthCallbackUrl()` currently does not accept a `next` argument.

- [ ] **Step 3: 콜백 페이지 실패 테스트 추가**

`src/app/[lang]/auth/callback/page.test.tsx`를 만들고 아래 3개 케이스를 넣는다.

```tsx
it("redirects linked Google flows back to account without closing the tab", async () => {
  window.history.replaceState(
    null,
    "",
    "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle#access_token=a&refresh_token=b"
  );

  render(<AuthCallbackPage />);

  await waitFor(() => {
    expect(routerReplaceMock).toHaveBeenCalledWith("/ko/account?linked=google");
  });

  expect(windowCloseMock).not.toHaveBeenCalled();
});

it("defaults successful sign-in callbacks to the locale browse page", async () => {
  getUserMock.mockResolvedValue({
    data: { user: { id: "user-1" } },
  });

  render(<AuthCallbackPage />);

  await waitFor(() => {
    expect(routerReplaceMock).toHaveBeenCalledWith("/ko/browse");
  });
});

it("routes failed link callbacks back to account with an inline error flag", async () => {
  window.history.replaceState(
    null,
    "",
    "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle"
  );

  getUserMock.mockResolvedValue({
    data: { user: null },
  });

  render(<AuthCallbackPage />);

  await waitFor(() => {
    expect(routerReplaceMock).toHaveBeenCalledWith("/ko/account?linkError=google");
  });
});
```

- [ ] **Step 4: 콜백 테스트가 실제로 실패하는지 확인**

Run: `npx vitest run 'src/app/[lang]/auth/callback/page.test.tsx'`
Expected: FAIL because the page currently calls `window.close()` and does not redirect based on `next`.

- [ ] **Step 5: 최소 구현 작성**

`src/lib/authRedirect.ts`를 아래 구조로 수정한다.

```ts
export function buildAuthCallbackUrl(
  lang: string,
  currentOrigin?: string,
  next?: string
): string | null {
  const origin =
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeOrigin(currentOrigin);

  if (!origin) return null;

  const fallback = `/${lang}/browse`;
  const safeNext = sanitizePostAuthRedirect(next, fallback);
  const url = new URL(`/${lang}/auth/callback`, `${origin}/`);
  url.searchParams.set("next", safeNext);
  return url.toString();
}
```

`src/app/[lang]/auth/callback/page.tsx`는 아래 흐름으로 바꾼다.

```tsx
const searchParams = new URLSearchParams(window.location.search);
const fallback = `/${lang}/browse`;
const next = sanitizePostAuthRedirect(searchParams.get("next"), fallback);

function onSuccess() {
  if (handled.current) return;
  handled.current = true;

  try {
    const bc = new BroadcastChannel("reflix-auth");
    bc.postMessage("SIGNED_IN");
    bc.close();
  } catch {}

  setState("done");
  router.replace(next);
}

function getFailureDestination() {
  if (next.startsWith(`/${lang}/account`)) {
    return `/${lang}/account?linkError=google`;
  }

  return `/${lang}/login?error=auth`;
}
```

Error 상태에서 버튼도 `/${lang}/login` 고정 대신 `failureDestination`으로 이동하게 맞춘다.

- [ ] **Step 6: Task 1 테스트 재실행**

Run: `npx vitest run src/lib/authRedirect.test.ts 'src/app/[lang]/auth/callback/page.test.tsx'`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/authRedirect.ts src/lib/authRedirect.test.ts src/app/[lang]/auth/callback/page.tsx src/app/[lang]/auth/callback/page.test.tsx
git commit -m "feat(auth): redirect auth callbacks without closing the tab"
```

---

### Task 2: 계정 페이지에 Google 연결 UI와 identity 로딩 추가

**Files:**
- Create: `src/app/[lang]/account/AccountClient.test.tsx`
- Modify: `src/app/[lang]/account/AccountClient.tsx`
- Modify: `src/app/[lang]/account/page.tsx`

- [ ] **Step 1: 계정 페이지 실패 테스트 먼저 추가**

`src/app/[lang]/account/AccountClient.test.tsx`를 만들고 아래 케이스를 넣는다.

```tsx
it("shows a Connect Google button when Google is not linked", async () => {
  getUserIdentitiesMock.mockResolvedValue({
    data: {
      identities: [{ provider: "email", identity_id: "email-1" }],
    },
    error: null,
  });

  render(
    <AccountClient
      lang="ko"
      dict={dict}
      searchParams={{}}
    />
  );

  expect(await screen.findByRole("button", { name: "Google 연결" })).toBeInTheDocument();
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

  render(
    <AccountClient
      lang="ko"
      dict={dict}
      searchParams={{ linked: "google" }}
    />
  );

  expect(await screen.findByText("연결됨")).toBeInTheDocument();
  expect(screen.getByText("Google 연결이 완료되었습니다.")).toBeInTheDocument();
});

it("starts manual Google linking with an account return URL", async () => {
  getUserIdentitiesMock.mockResolvedValue({
    data: { identities: [{ provider: "email", identity_id: "email-1" }] },
    error: null,
  });

  render(
    <AccountClient
      lang="ko"
      dict={dict}
      searchParams={{}}
    />
  );

  fireEvent.click(await screen.findByRole("button", { name: "Google 연결" }));

  expect(linkIdentityMock).toHaveBeenCalledWith({
    provider: "google",
    options: {
      redirectTo:
        "http://localhost:3000/ko/auth/callback?next=%2Fko%2Faccount%3Flinked%3Dgoogle",
    },
  });
});

it("shows an inline error when identities fail to load", async () => {
  getUserIdentitiesMock.mockResolvedValue({
    data: null,
    error: { message: "boom" },
  });

  render(
    <AccountClient
      lang="ko"
      dict={dict}
      searchParams={{ linkError: "google" }}
    />
  );

  expect(
    await screen.findByText("Google 연결을 완료하지 못했습니다. 다시 시도해주세요.")
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: 계정 테스트가 실제로 실패하는지 확인**

Run: `npx vitest run 'src/app/[lang]/account/AccountClient.test.tsx'`
Expected: FAIL because the component does not fetch identities, does not accept `searchParams`, and has no Google linking UI.

- [ ] **Step 3: 최소 구현 작성**

`src/app/[lang]/account/page.tsx`에서 `searchParams`를 받아 `AccountClient`로 넘긴다.

```tsx
export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ linked?: string; linkError?: string }>;
}) {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  const resolvedSearchParams = await searchParams;

  return (
    <AccountClient
      lang={lang as Locale}
      dict={dict}
      searchParams={resolvedSearchParams}
    />
  );
}
```

`src/app/[lang]/account/AccountClient.tsx`는 아래 상태를 추가한다.

```tsx
const [identitiesLoading, setIdentitiesLoading] = useState(true);
const [identitiesError, setIdentitiesError] = useState("");
const [isGoogleLinked, setIsGoogleLinked] = useState(false);
const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

useEffect(() => {
  if (!user) return;

  const supabase = createClient();
  if (!supabase) {
    setIdentitiesError(isKo ? "로그인 연결 기능이 아직 설정되지 않았습니다." : "Sign-in linking is not configured yet.");
    setIdentitiesLoading(false);
    return;
  }

  async function loadIdentities() {
    setIdentitiesLoading(true);
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      setIdentitiesError(isKo ? "로그인 방법을 불러오지 못했습니다." : "Could not load sign-in methods.");
      setIdentitiesLoading(false);
      return;
    }

    setIsGoogleLinked(
      (data?.identities ?? []).some((identity) => identity.provider === "google")
    );
    setIdentitiesError("");
    setIdentitiesLoading(false);
  }

  void loadIdentities();
}, [user, isKo]);
```

Google 연결 액션은 아래 형태로 구현한다.

```tsx
async function handleConnectGoogle() {
  const supabase = createClient();
  if (!supabase) return;

  const redirectTo = buildAuthCallbackUrl(
    lang,
    window.location.origin,
    `/${lang}/account?linked=google`
  );

  if (!redirectTo) {
    setIdentitiesError(isKo ? "Google 연결 설정이 올바르지 않습니다." : "Google linking is misconfigured.");
    return;
  }

  setIsLinkingGoogle(true);
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo },
  });

  if (error) {
    setIdentitiesError(
      isKo ? "Google 연결을 시작하지 못했습니다. 다시 시도해주세요." : "Could not start Google linking. Please try again."
    );
    setIsLinkingGoogle(false);
  }
}
```

그리고 기존 구독 카드 아래에 로그인 방법 카드를 추가한다.

```tsx
<div className="rounded-lg border border-border bg-surface p-4">
  <p className="text-sm font-medium">{isKo ? "로그인 방법" : "Sign-in methods"}</p>
  {searchParams.linked === "google" ? (
    <p className="mt-2 text-xs text-green-600">
      {isKo ? "Google 연결이 완료되었습니다." : "Google was connected successfully."}
    </p>
  ) : null}
  {searchParams.linkError === "google" ? (
    <p className="mt-2 text-xs text-red-500">
      {isKo ? "Google 연결을 완료하지 못했습니다. 다시 시도해주세요." : "Could not finish Google linking. Please try again."}
    </p>
  ) : null}
</div>
```

- [ ] **Step 4: Task 2 테스트 재실행**

Run: `npx vitest run 'src/app/[lang]/account/AccountClient.test.tsx'`
Expected: PASS

- [ ] **Step 5: 리다이렉트 + 계정 테스트를 함께 재확인**

Run: `npx vitest run src/lib/authRedirect.test.ts 'src/app/[lang]/auth/callback/page.test.tsx' 'src/app/[lang]/account/AccountClient.test.tsx'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/[lang]/account/page.tsx src/app/[lang]/account/AccountClient.tsx src/app/[lang]/account/AccountClient.test.tsx
git commit -m "feat(account): add Google identity linking controls"
```

---

### Task 3: 최종 회귀 검증

**Files:**
- Modify: none expected

- [ ] **Step 1: 전체 관련 테스트 실행**

Run: `npx vitest run src/lib/authRedirect.test.ts 'src/app/[lang]/auth/callback/page.test.tsx' 'src/app/[lang]/account/AccountClient.test.tsx' src/components/auth/AuthProvider.test.tsx`
Expected: PASS

- [ ] **Step 2: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: 작업 트리 확인**

Run: `git status --short`
Expected: 이번 기능과 직접 관련된 파일만 변경되어 있음

- [ ] **Step 4: Commit (필요한 후속 수정이 생긴 경우만)**

```bash
git add -u
git commit -m "test: verify Google identity linking flow"
```
