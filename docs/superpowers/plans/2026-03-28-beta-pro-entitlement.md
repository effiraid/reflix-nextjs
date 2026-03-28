# Beta Pro Entitlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add beta-only Pro access that expires automatically without corrupting paid subscription state.

**Architecture:** Keep `profiles.tier` as billing truth, add `beta_access_grants` as temporary entitlement truth, and compute `effective access` in one shared helper used by proxy, auth hydration, and UI. Preserve the existing `tier` field in the auth store as the effective tier so most gating code keeps working, while adding `planTier`, `accessSource`, and `betaEndsAt` for beta-aware UI.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest, Supabase SSR/browser clients, Supabase SQL migrations, Node test runner

---

## File Structure

- Create: `supabase/migrations/002_beta_access_grants.sql` — beta entitlement table, indexes, and RLS
- Create: `src/lib/access.ts` — pure access types and resolver
- Create: `src/lib/access.test.ts` — unit tests for paid/beta/free resolution
- Create: `src/lib/supabase/access.ts` — Supabase-backed access loader
- Create: `src/lib/supabase/access.test.ts` — tests for active/expired grant loading
- Create: `scripts/grant-beta-access.mjs` — operator CLI to grant beta access by email
- Create: `scripts/grant-beta-access.test.mjs` — node tests for CLI arg parsing
- Modify: `src/stores/authStore.ts` — keep effective tier, add `planTier`, `accessSource`, `betaEndsAt`
- Modify: `src/components/auth/AuthProvider.tsx` — hydrate effective access via shared loader
- Modify: `src/components/auth/AuthProvider.test.tsx` — mock shared loader and assert beta hydration
- Modify: `src/proxy.ts` — issue media session cookies from effective access
- Modify: `src/proxy.test.ts` — assert beta users receive Pro media access
- Modify: `src/lib/mediaSession.ts` — optionally carry `accessSource` in v2 payload
- Modify: `src/lib/mediaSession.test.ts` — round-trip payload with `accessSource`
- Modify: `src/app/[lang]/account/AccountClient.tsx` — show beta state and end date
- Modify: `src/app/[lang]/account/AccountClient.test.tsx` — beta state UI regression tests
- Modify: `src/components/pricing/PricingModal.tsx` — beta users can still subscribe
- Modify: `src/components/pricing/PricingModal.test.tsx` — beta users still see subscribe CTA
- Modify: `src/components/layout/Navbar.tsx` — differentiate paid Pro from beta Pro in menu
- Modify: `src/components/layout/Navbar.test.tsx` — beta user still sees upgrade action
- Modify: `src/app/[lang]/dictionaries/ko.json` — beta account strings
- Modify: `src/app/[lang]/dictionaries/en.json` — beta account strings
- Modify: `package.json` — add `beta:grant` script
- Modify: `CLAUDE.md` — document the beta grant command for future operators

## Notes Before Starting

- Do **not** add a new `tier` value like `"beta"`. The billing tier stays `free | pro`.
- Do **not** touch `src/app/api/checkout/route.ts` or `src/app/api/webhooks/stripe/route.ts` in this pass. They already operate on paid subscriptions only, which is exactly what we want.
- Existing gate checks like `tier === "pro"` in `BrowseClient`, `SubToolbar`, and `BoardPanel` should keep working because the store will continue exposing `tier` as the **effective** tier.

### Task 1: Add the entitlement schema and pure access resolver

**Files:**
- Create: `src/lib/access.ts`
- Create: `src/lib/access.test.ts`
- Create: `supabase/migrations/002_beta_access_grants.sql`

- [ ] **Step 1: Write the failing resolver tests**

Create `src/lib/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveEffectiveAccess, type BetaAccessGrant } from "./access";

const activeGrant: BetaAccessGrant = {
  id: "grant-1",
  userId: "user-1",
  source: "manual",
  campaignKey: "cohort-1",
  startsAt: "2026-03-28T00:00:00.000Z",
  endsAt: "2026-04-30T00:00:00.000Z",
  revokedAt: null,
  note: null,
};

describe("resolveEffectiveAccess", () => {
  it("keeps a paid user on paid pro even when a beta grant also exists", () => {
    expect(
      resolveEffectiveAccess({
        planTier: "pro",
        betaGrant: activeGrant,
        nowIso: "2026-04-01T00:00:00.000Z",
      })
    ).toMatchObject({
      planTier: "pro",
      effectiveTier: "pro",
      accessSource: "paid",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
    });
  });

  it("upgrades a free user to beta pro while the grant is active", () => {
    expect(
      resolveEffectiveAccess({
        planTier: "free",
        betaGrant: activeGrant,
        nowIso: "2026-04-01T00:00:00.000Z",
      })
    ).toMatchObject({
      planTier: "free",
      effectiveTier: "pro",
      accessSource: "beta",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
    });
  });

  it("falls back to free when the beta grant is expired", () => {
    expect(
      resolveEffectiveAccess({
        planTier: "free",
        betaGrant: activeGrant,
        nowIso: "2026-05-01T00:00:00.000Z",
      })
    ).toMatchObject({
      planTier: "free",
      effectiveTier: "free",
      accessSource: "free",
      betaEndsAt: null,
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails because the module does not exist yet**

Run:

```bash
npx vitest run src/lib/access.test.ts
```

Expected: FAIL with a module-not-found error for `./access`

- [ ] **Step 3: Implement the pure access domain**

Create `src/lib/access.ts`:

```ts
export type Tier = "free" | "pro";
export type AccessSource = "free" | "paid" | "beta";
export type BetaGrantSource = "manual" | "invite" | "campaign";

export interface BetaAccessGrant {
  id: string;
  userId: string;
  source: BetaGrantSource;
  campaignKey: string | null;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  note: string | null;
}

export interface EffectiveAccess {
  planTier: Tier;
  effectiveTier: Tier;
  accessSource: AccessSource;
  betaEndsAt: string | null;
}

function isGrantActive(grant: BetaAccessGrant | null, nowIso: string) {
  if (!grant) return false;
  if (grant.revokedAt) return false;
  return grant.startsAt <= nowIso && grant.endsAt > nowIso;
}

export function resolveEffectiveAccess({
  planTier,
  betaGrant,
  nowIso = new Date().toISOString(),
}: {
  planTier: Tier;
  betaGrant: BetaAccessGrant | null;
  nowIso?: string;
}): EffectiveAccess {
  if (planTier === "pro") {
    return {
      planTier,
      effectiveTier: "pro",
      accessSource: "paid",
      betaEndsAt: betaGrant?.endsAt ?? null,
    };
  }

  if (isGrantActive(betaGrant, nowIso)) {
    return {
      planTier,
      effectiveTier: "pro",
      accessSource: "beta",
      betaEndsAt: betaGrant!.endsAt,
    };
  }

  return {
    planTier,
    effectiveTier: "free",
    accessSource: "free",
    betaEndsAt: null,
  };
}
```

- [ ] **Step 4: Run the resolver tests and confirm they pass**

Run:

```bash
npx vitest run src/lib/access.test.ts
```

Expected: PASS with 3 passing tests

- [ ] **Step 5: Add the Supabase migration**

Create `supabase/migrations/002_beta_access_grants.sql`:

```sql
CREATE TABLE public.beta_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('manual', 'invite', 'campaign')),
  campaign_key TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  note TEXT,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX beta_access_grants_user_id_idx
  ON public.beta_access_grants (user_id);

CREATE INDEX beta_access_grants_active_window_idx
  ON public.beta_access_grants (user_id, starts_at, ends_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.beta_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own beta access grants"
  ON public.beta_access_grants
  FOR SELECT
  USING (auth.uid() = user_id);
```

- [ ] **Step 6: Smoke-check the migration file contains the required table, RLS, and indexes**

Run:

```bash
rg -n "CREATE TABLE public.beta_access_grants|CREATE INDEX beta_access_grants|ENABLE ROW LEVEL SECURITY|Users can read own beta access grants" supabase/migrations/002_beta_access_grants.sql
```

Expected: 4 matching lines covering the table, indexes, RLS, and policy

- [ ] **Step 7: Commit Task 1**

```bash
git add src/lib/access.ts src/lib/access.test.ts supabase/migrations/002_beta_access_grants.sql
git commit -m "feat: add beta access entitlement model"
```

### Task 2: Load effective access from Supabase and use it in proxy/session tokens

**Files:**
- Create: `src/lib/supabase/access.ts`
- Create: `src/lib/supabase/access.test.ts`
- Modify: `src/proxy.ts`
- Modify: `src/proxy.test.ts`
- Modify: `src/lib/mediaSession.ts`
- Modify: `src/lib/mediaSession.test.ts`

- [ ] **Step 1: Write the failing loader and proxy tests**

Create `src/lib/supabase/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadEffectiveAccess } from "./access";

function createMockClient({
  planTier = "free",
  grant = null,
}: {
  planTier?: "free" | "pro";
  grant?: Record<string, unknown> | null;
}) {
  return {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { tier: planTier }, error: null }),
            }),
          }),
        };
      }

      if (table === "beta_access_grants") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                lte: () => ({
                  gt: () => ({
                    order: () => ({
                      limit: async () => ({
                        data: grant ? [grant] : [],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("loadEffectiveAccess", () => {
  it("returns beta access for a free user with an active grant", async () => {
    const access = await loadEffectiveAccess(
      createMockClient({
        planTier: "free",
        grant: {
          id: "grant-1",
          user_id: "user-1",
          source: "manual",
          campaign_key: "cohort-1",
          starts_at: "2026-03-28T00:00:00.000Z",
          ends_at: "2026-04-30T00:00:00.000Z",
          revoked_at: null,
          note: null,
        },
      }) as never,
      "user-1",
      "2026-04-01T00:00:00.000Z"
    );

    expect(access).toMatchObject({
      planTier: "free",
      effectiveTier: "pro",
      accessSource: "beta",
    });
  });
});
```

Update `src/proxy.test.ts` by first extending the hoisted auth state and mocked `beta_access_grants` branch:

```ts
const { authState } = vi.hoisted(() => ({
  authState: {
    user: null as { id: string } | null,
    profileTier: "free" as "free" | "pro",
    betaGrant: null as Record<string, unknown> | null,
  },
}));

if (table === "beta_access_grants") {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        is: vi.fn(() => ({
          lte: vi.fn(() => ({
            gt: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: authState.betaGrant ? [authState.betaGrant] : [],
                })),
              })),
            })),
          })),
        })),
      })),
    })),
  };
}
```

Then replace the stale "any authenticated user as pro" case with this beta-specific case:

```ts
it("treats a free user with an active beta grant as pro in the media session token", async () => {
  vi.stubEnv("NEXT_PUBLIC_MEDIA_URL", "https://media.reflix.dev");
  vi.stubEnv("MEDIA_SESSION_SECRET", "test-secret");
  vi.stubEnv("MEDIA_SESSION_COOKIE_DOMAIN", ".reflix.dev");
  authState.user = { id: "user-123" };
  authState.profileTier = "free";
  authState.betaGrant = {
    id: "grant-1",
    user_id: "user-123",
    source: "manual",
    campaign_key: "cohort-1",
    starts_at: "2026-03-28T00:00:00.000Z",
    ends_at: "2026-04-30T00:00:00.000Z",
    revoked_at: null,
    note: null,
  };

  const response = await proxy(new NextRequest("https://reflix.dev/ko/browse"));
  const token = response.cookies.get(MEDIA_SESSION_COOKIE_NAME)?.value;
  const payload = await verifyMediaSessionToken(token!, "test-secret", Date.now());

  expect(payload).toMatchObject({
    v: 2,
    userId: "user-123",
    tier: "pro",
    accessSource: "beta",
  });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run:

```bash
npx vitest run src/lib/supabase/access.test.ts src/proxy.test.ts src/lib/mediaSession.test.ts
```

Expected: FAIL because `src/lib/supabase/access.ts` does not exist and `accessSource` is not part of the media token yet

- [ ] **Step 3: Implement the shared loader and wire proxy/media session to it**

Create `src/lib/supabase/access.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveEffectiveAccess,
  type BetaAccessGrant,
  type EffectiveAccess,
  type Tier,
} from "@/lib/access";

type AccessClient = Pick<SupabaseClient, "from">;

type BetaGrantRow = {
  id: string;
  user_id: string;
  source: "manual" | "invite" | "campaign";
  campaign_key: string | null;
  starts_at: string;
  ends_at: string;
  revoked_at: string | null;
  note: string | null;
};

function mapGrant(row: BetaGrantRow | null): BetaAccessGrant | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    campaignKey: row.campaign_key,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    revokedAt: row.revoked_at,
    note: row.note,
  };
}

export async function loadEffectiveAccess(
  client: AccessClient,
  userId: string,
  nowIso = new Date().toISOString()
): Promise<EffectiveAccess> {
  const [{ data: profile }, { data: grants }] = await Promise.all([
    client.from("profiles").select("tier").eq("id", userId).single(),
    client
      .from("beta_access_grants")
      .select("id,user_id,source,campaign_key,starts_at,ends_at,revoked_at,note")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: false })
      .limit(1),
  ]);

  const planTier = profile?.tier === "pro" ? "pro" : ("free" as Tier);
  return resolveEffectiveAccess({
    planTier,
    betaGrant: mapGrant((grants?.[0] as BetaGrantRow | undefined) ?? null),
    nowIso,
  });
}
```

Update `src/lib/mediaSession.ts`:

```ts
type MediaSessionPayloadV2 = {
  v: 2;
  host: string;
  exp: number;
  userId?: string;
  tier: "free" | "pro";
  accessSource?: "free" | "paid" | "beta";
};
```

Update the signed payload test in `src/lib/mediaSession.test.ts`:

```ts
const token = await signMediaSessionToken(
  {
    v: 2,
    host: "reflix.dev",
    exp: now + 60_000,
    userId: "user-123",
    tier: "pro",
    accessSource: "beta",
  },
  "test-secret"
);
```

Update `src/proxy.ts` so the helper returns full access instead of a raw tier:

```ts
import { loadEffectiveAccess } from "@/lib/supabase/access";

async function getSessionAccess(request: NextRequest): Promise<{
  userId?: string;
  effectiveTier: "free" | "pro";
  accessSource: "free" | "paid" | "beta";
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { effectiveTier: "free", accessSource: "free" };
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { effectiveTier: "free", accessSource: "free" };

    const access = await loadEffectiveAccess(supabase as never, user.id);
    return {
      userId: user.id,
      effectiveTier: access.effectiveTier,
      accessSource: access.accessSource,
    };
  } catch {
    return { effectiveTier: "free", accessSource: "free" };
  }
}
```

Then use it when signing the cookie:

```ts
const { userId, effectiveTier, accessSource } = await getSessionAccess(request);

const token = await signMediaSessionToken(
  {
    v: 2,
    host: request.nextUrl.hostname,
    exp: now + config.ttlSeconds * 1000,
    userId,
    tier: effectiveTier,
    accessSource,
  },
  config.secret
);
```

- [ ] **Step 4: Re-run the loader/proxy/media session tests**

Run:

```bash
npx vitest run src/lib/supabase/access.test.ts src/proxy.test.ts src/lib/mediaSession.test.ts
```

Expected: PASS with all new loader and beta-session assertions green

- [ ] **Step 5: Commit Task 2**

```bash
git add src/lib/supabase/access.ts src/lib/supabase/access.test.ts src/proxy.ts src/proxy.test.ts src/lib/mediaSession.ts src/lib/mediaSession.test.ts
git commit -m "feat: resolve effective access for beta grants"
```

### Task 3: Hydrate beta access into the client store and update beta-aware UI

**Files:**
- Modify: `src/stores/authStore.ts`
- Modify: `src/components/auth/AuthProvider.tsx`
- Modify: `src/components/auth/AuthProvider.test.tsx`
- Modify: `src/app/[lang]/account/AccountClient.tsx`
- Modify: `src/app/[lang]/account/AccountClient.test.tsx`
- Modify: `src/components/pricing/PricingModal.tsx`
- Modify: `src/components/pricing/PricingModal.test.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/Navbar.test.tsx`
- Modify: `src/app/[lang]/dictionaries/ko.json`
- Modify: `src/app/[lang]/dictionaries/en.json`

- [ ] **Step 1: Write the failing client-side regression tests**

Update `src/components/auth/AuthProvider.test.tsx` to mock the shared loader instead of hand-building table responses:

```ts
const { loadEffectiveAccessMock } = vi.hoisted(() => ({
  loadEffectiveAccessMock: vi.fn(),
}));

vi.mock("@/lib/supabase/access", () => ({
  loadEffectiveAccess: loadEffectiveAccessMock,
}));

it("stores beta access metadata while keeping tier as effective pro", async () => {
  loadEffectiveAccessMock.mockResolvedValue({
    planTier: "free",
    effectiveTier: "pro",
    accessSource: "beta",
    betaEndsAt: "2026-04-30T00:00:00.000Z",
  });

  render(
    <AuthProvider>
      <div>child</div>
    </AuthProvider>
  );

  await waitFor(() => {
    expect(authHarness.callback).not.toBeNull();
  });

  await act(async () => {
    authHarness.callback?.("SIGNED_IN", { user: { id: "user-1" } });
  });

  await waitFor(() => {
    expect(useAuthStore.getState()).toMatchObject({
      tier: "pro",
      planTier: "free",
      accessSource: "beta",
      betaEndsAt: "2026-04-30T00:00:00.000Z",
    });
  });
});
```

Update `src/app/[lang]/account/AccountClient.test.tsx` by replacing the empty dict stub and adding a beta-specific state:

```ts
const dict = {
  account: {
    proActive: "Pro 구독 활성",
    freeTier: "무료 티어",
    manageViaStripe: "구독 관리는 Stripe Customer Portal에서 할 수 있습니다.",
    upgradeToPro: "Pro로 업그레이드",
    betaActive: "Pro 체험 중",
    betaEndsOn: "베타 종료일",
    betaRevertsToFree: "종료 후 무료 티어로 전환됩니다.",
  },
} as Dictionary;

it("shows beta status and beta end date for a trial user", async () => {
  useAuthStore.setState({
    user: { id: "user-1", email: "user@example.com" } as never,
    tier: "pro",
    planTier: "free",
    accessSource: "beta",
    betaEndsAt: "2026-04-30T00:00:00.000Z",
    isLoading: false,
  });

  render(<AccountClient lang="ko" dict={dict} />);

  expect(await screen.findByText("Pro 체험 중")).toBeInTheDocument();
  expect(screen.getByText("종료 후 무료 티어로 전환됩니다.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pro로 업그레이드" })).toBeInTheDocument();
});
```

Update `src/components/pricing/PricingModal.test.tsx`:

```ts
it("keeps the subscribe CTA enabled for beta users", () => {
  useAuthStore.setState({
    user: { id: "user-1", email: "user@example.com" } as never,
    tier: "pro",
    planTier: "free",
    accessSource: "beta",
    betaEndsAt: "2026-04-30T00:00:00.000Z",
    isLoading: false,
  });

  render(<PricingModal lang="ko" dict={dict} />);

  expect(
    screen.getByRole("button", { name: "Pro 시작하기" })
  ).toBeEnabled();
});
```

Update `src/components/layout/Navbar.test.tsx`:

```ts
import { useAuthStore } from "@/stores/authStore";

it("shows Upgrade to Pro for beta users instead of Manage subscription", () => {
  useAuthStore.setState({
    user: { id: "user-1", email: "user@example.com" } as never,
    tier: "pro",
    planTier: "free",
    accessSource: "beta",
    betaEndsAt: "2026-04-30T00:00:00.000Z",
    isLoading: false,
  });

  render(<Navbar lang="ko" dict={dict} />);
  fireEvent.click(screen.getByRole("button", { name: "사용자 메뉴" }));

  expect(screen.getByText("Pro 업그레이드")).toBeInTheDocument();
  expect(screen.queryByText("구독 관리")).toBeNull();
});
```

- [ ] **Step 2: Run the UI tests and confirm they fail**

Run:

```bash
npx vitest run src/components/auth/AuthProvider.test.tsx src/app/[lang]/account/AccountClient.test.tsx src/components/pricing/PricingModal.test.tsx src/components/layout/Navbar.test.tsx
```

Expected: FAIL because the auth store has no beta metadata yet and the UI still treats beta users as paid Pro

- [ ] **Step 3: Extend the auth store and hydrate effective access**

Update `src/stores/authStore.ts`:

```ts
import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { AccessSource, EffectiveAccess, Tier } from "@/lib/access";

interface AuthState {
  user: User | null;
  tier: Tier;
  planTier: Tier;
  accessSource: AccessSource;
  betaEndsAt: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAccess: (access: EffectiveAccess) => void;
  resetAccess: () => void;
  setLoading: (loading: boolean) => void;
}

const freeAccess: EffectiveAccess = {
  planTier: "free",
  effectiveTier: "free",
  accessSource: "free",
  betaEndsAt: null,
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  tier: "free",
  planTier: "free",
  accessSource: "free",
  betaEndsAt: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setAccess: (access) =>
    set({
      tier: access.effectiveTier,
      planTier: access.planTier,
      accessSource: access.accessSource,
      betaEndsAt: access.betaEndsAt,
    }),
  resetAccess: () => set(freeAccess),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

Update `src/components/auth/AuthProvider.tsx`:

```ts
import { loadEffectiveAccess } from "@/lib/supabase/access";

const { setUser, setAccess, resetAccess, setLoading } = useAuthStore();

async function loadAccess(userId: string) {
  try {
    const access = await loadEffectiveAccess(client as never, userId);
    setAccess(access);
  } catch {
    resetAccess();
  }
}

if (!supabase) {
  setUser(null);
  resetAccess();
  setLoading(false);
  return;
}

// later in acceptCurrentTabSession
setUser(user);
setLoading(false);
void loadAccess(user.id);

// on sign-out/superseded tab
setUser(null);
resetAccess();
setLoading(false);
```

- [ ] **Step 4: Make account, pricing, and navbar beta-aware**

Add these account strings to both dictionary files:

`src/app/[lang]/dictionaries/ko.json`

```json
"betaActive": "Pro 체험 중",
"betaEndsOn": "베타 종료일",
"betaRevertsToFree": "종료 후 무료 티어로 전환됩니다.",
"betaBadge": "BETA"
```

`src/app/[lang]/dictionaries/en.json`

```json
"betaActive": "Pro beta access",
"betaEndsOn": "Beta ends",
"betaRevertsToFree": "This account will return to the free tier when beta ends.",
"betaBadge": "BETA"
```

Update `src/app/[lang]/account/AccountClient.tsx` to show beta state from `accessSource`:

```tsx
const { user, tier, accessSource, betaEndsAt, isLoading } = useAuthStore();

const betaDateLabel = betaEndsAt
  ? new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(betaEndsAt))
  : null;

const isPaidPro = accessSource === "paid";
const isBetaPro = accessSource === "beta";

<p className="mt-1 text-sm text-muted">
  {isPaidPro
    ? dict.account.proActive
    : isBetaPro
      ? dict.account.betaActive
      : dict.account.freeTier}
</p>

{isBetaPro ? (
  <div className="mt-2 space-y-1 text-xs text-muted">
    <p>{dict.account.betaEndsOn}: {betaDateLabel}</p>
    <p>{dict.account.betaRevertsToFree}</p>
  </div>
) : isPaidPro ? (
  <p className="mt-2 text-xs text-muted">{dict.account.manageViaStripe}</p>
) : null}
```

Update `src/components/pricing/PricingModal.tsx`:

```tsx
const { user, accessSource } = useAuthStore();
const isPaidPro = accessSource === "paid";

if (!user) {
  closePricingModal();
  router.push(`/${lang}/login`);
  return;
}

if (isPaidPro || loading) return;

proAction={{
  label: loading
    ? dict.preparingCheckout
    : isPaidPro
      ? dict.currentPlan
      : dict.proCta,
  onClick: handleSubscribe,
  disabled: isPaidPro || loading,
}}
```

Update `src/components/layout/Navbar.tsx`:

```tsx
const { user, tier, accessSource, isLoading: authLoading } = useAuthStore();

<UserMenu
  lang={lang}
  tier={tier}
  accessSource={accessSource}
  userMenuOpen={userMenuOpen}
  setUserMenuOpen={setUserMenuOpen}
/>
```

And in `UserMenu`:

```tsx
function UserMenu({
  lang,
  tier,
  accessSource,
  userMenuOpen,
  setUserMenuOpen,
}: {
  lang: Locale;
  tier: "free" | "pro";
  accessSource: "free" | "paid" | "beta";
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
}) {
  const isKo = lang === "ko";
  const isPaidPro = accessSource === "paid";
  const isBetaPro = accessSource === "beta";
  const { openPricingModal } = useUIStore();

  <button
    type="button"
    onClick={() => setUserMenuOpen(!userMenuOpen)}
    aria-label={isKo ? "사용자 메뉴" : "User menu"}
    className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-surface-hover"
    aria-expanded={userMenuOpen}
    aria-haspopup="true"
  >
    <UserIcon className="size-3.5" strokeWidth={1.75} />
    {isPaidPro ? (
      <span className="rounded bg-accent/20 px-1 py-0.5 text-[10px] font-semibold leading-none text-accent">
        PRO
      </span>
    ) : isBetaPro ? (
      <span className="rounded bg-foreground/10 px-1 py-0.5 text-[10px] font-semibold leading-none text-foreground/70">
        BETA
      </span>
    ) : null}
  </button>

  {!isPaidPro ? (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-accent hover:bg-surface-hover"
      onClick={() => {
        setUserMenuOpen(false);
        openPricingModal();
      }}
    >
      <CrownIcon className="size-3.5" strokeWidth={1.75} />
      {isKo ? "Pro 업그레이드" : "Upgrade to Pro"}
    </button>
  ) : (
    <Link
      href={`/${lang}/account`}
      className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover"
      onClick={() => setUserMenuOpen(false)}
    >
      <CrownIcon className="size-3.5" strokeWidth={1.75} />
      {isKo ? "구독 관리" : "Manage subscription"}
    </Link>
  )}
}
```

- [ ] **Step 5: Re-run the auth and UI tests**

Run:

```bash
npx vitest run src/components/auth/AuthProvider.test.tsx src/app/[lang]/account/AccountClient.test.tsx src/components/pricing/PricingModal.test.tsx src/components/layout/Navbar.test.tsx
```

Expected: PASS with beta hydration, beta account copy, beta pricing CTA, and beta navbar behavior all green

- [ ] **Step 6: Commit Task 3**

```bash
git add src/stores/authStore.ts src/components/auth/AuthProvider.tsx src/components/auth/AuthProvider.test.tsx src/app/[lang]/account/AccountClient.tsx src/app/[lang]/account/AccountClient.test.tsx src/components/pricing/PricingModal.tsx src/components/pricing/PricingModal.test.tsx src/components/layout/Navbar.tsx src/components/layout/Navbar.test.tsx src/app/[lang]/dictionaries/ko.json src/app/[lang]/dictionaries/en.json
git commit -m "feat: surface beta pro access in auth and ui"
```

### Task 4: Add operator tooling and run the full beta regression pass

**Files:**
- Create: `scripts/grant-beta-access.mjs`
- Create: `scripts/grant-beta-access.test.mjs`
- Modify: `package.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write the failing CLI arg parser test**

Create `scripts/grant-beta-access.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { parseArgs } from "./grant-beta-access.mjs";

test("parseArgs reads email, days, note, and source", () => {
  assert.deepEqual(
    parseArgs([
      "--email",
      "beta@reflix.dev",
      "--days",
      "14",
      "--source",
      "manual",
      "--note",
      "cohort-1",
    ]),
    {
      email: "beta@reflix.dev",
      days: 14,
      source: "manual",
      note: "cohort-1",
    }
  );
});
```

- [ ] **Step 2: Run the node test and confirm it fails**

Run:

```bash
node --test scripts/grant-beta-access.test.mjs
```

Expected: FAIL because `grant-beta-access.mjs` does not exist yet

- [ ] **Step 3: Implement the grant script and document it**

Create `scripts/grant-beta-access.mjs`:

```js
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

export function parseArgs(argv) {
  const args = { source: "manual", note: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === "--email") args.email = value;
    if (token === "--days") args.days = Number.parseInt(value, 10);
    if (token === "--source") args.source = value;
    if (token === "--note") args.note = value;
  }

  if (!args.email || !args.days) {
    throw new Error("Usage: --email <email> --days <days> [--source manual|invite|campaign] [--note text]");
  }

  return args;
}

async function main() {
  const { email, days, source, note } = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase admin credentials not configured");
  }

  const supabase = createClient(url, key);
  const { data: users, error: listUsersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listUsersError) {
    throw listUsersError;
  }

  const user = users.users.find((entry) => entry.email === email);

  if (!user) {
    throw new Error(`No auth user found for ${email}`);
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("beta_access_grants").insert({
    user_id: user.id,
    source,
    starts_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    note: note || null,
  });

  if (error) throw error;

  console.log(
    JSON.stringify({
      email,
      userId: user.id,
      source,
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
```

Update `package.json`:

```json
"beta:grant": "node scripts/grant-beta-access.mjs"
```

Add this command to the `CLAUDE.md` commands block:

```bash
npm run beta:grant -- --email test@reflix.dev --days 14 --note "cohort-1"
```

- [ ] **Step 4: Run the operator test and the full regression suite**

Run:

```bash
node --test scripts/grant-beta-access.test.mjs
npx vitest run src/lib/access.test.ts src/lib/supabase/access.test.ts src/lib/mediaSession.test.ts src/proxy.test.ts src/components/auth/AuthProvider.test.tsx src/app/[lang]/account/AccountClient.test.tsx src/components/pricing/PricingModal.test.tsx src/components/layout/Navbar.test.tsx
```

Expected: PASS for the node test and PASS for the full Vitest regression set

- [ ] **Step 5: Run the manual beta-access smoke check**

Run:

```bash
npm run beta:grant -- --email test@reflix.dev --days 7 --note "local-smoke"
```

Then verify manually in the browser:

```text
1. Sign in as test@reflix.dev
2. Open /ko/account and confirm:
   - "Pro 체험 중" is visible
   - a beta end date is visible
   - "종료 후 무료 티어로 전환됩니다." is visible
3. Open the pricing modal and confirm the subscribe button is still enabled
4. Update the same beta_access_grants row so ends_at is in the past
5. Refresh /ko/account and confirm the account now appears as free
```

- [ ] **Step 6: Commit Task 4**

```bash
git add scripts/grant-beta-access.mjs scripts/grant-beta-access.test.mjs package.json CLAUDE.md
git commit -m "feat: add beta access grant tooling"
```

## Self-Review Checklist

- Spec coverage:
  - Separate paid state from beta state: covered in Tasks 1-3
  - Automatic expiry without mass downgrades: covered in Tasks 1-2
  - Beta-aware UI: covered in Task 3
  - Operator grant workflow: covered in Task 4
- Placeholder scan:
  - No `TODO`, `TBD`, or “implement later” markers remain
  - All commands are concrete
  - Every code step includes explicit code
- Type consistency:
  - `tier` remains the effective tier everywhere
  - `planTier`, `accessSource`, and `betaEndsAt` are the new beta-aware fields
  - `beta_access_grants` row fields are consistently mapped between SQL, loader, and UI
