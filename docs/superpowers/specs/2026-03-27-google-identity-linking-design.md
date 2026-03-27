# Google Identity Linking Design

## Goal

Allow an existing Reflix user who is already signed in with email magic link to add Google as an extra sign-in method, without creating a second account.

This is an MVP for one provider only:

- In scope: Google manual linking from the account page
- In scope: show whether Google is already linked
- In scope: return the user to a sensible page after the linking flow finishes
- Out of scope: unlinking, Apple/GitHub, full multi-provider settings UI

## Current Project Context

Relevant existing pieces:

- [`src/app/[lang]/login/LoginForm.tsx`](/Users/macbook/reflix-nextjs/src/app/[lang]/login/LoginForm.tsx) already supports email magic link and Google OAuth sign-in
- [`src/app/[lang]/auth/callback/page.tsx`](/Users/macbook/reflix-nextjs/src/app/[lang]/auth/callback/page.tsx) already handles client-side auth callback completion
- [`src/app/[lang]/account/AccountClient.tsx`](/Users/macbook/reflix-nextjs/src/app/[lang]/account/AccountClient.tsx) already shows account information for logged-in users
- [`src/lib/supabase/client.ts`](/Users/macbook/reflix-nextjs/src/lib/supabase/client.ts) already creates the browser Supabase client
- [`src/components/auth/AuthProvider.tsx`](/Users/macbook/reflix-nextjs/src/components/auth/AuthProvider.tsx) already syncs auth session state into the client store

Important observation from the current flow:

- The existing client callback page is optimized for "finish auth and close/return to original tab" behavior.
- That behavior feels abrupt for same-tab OAuth redirects and should be removed.
- Manual identity linking will reuse OAuth, so this flow should become explicit about where the user lands after success.

## User Problem

Today a user can:

- sign in with email magic link
- sign in with Google

But they cannot clearly tell the system:

- "I already have an account"
- "Please add Google as another way into this same account"

Without identity linking, users are more likely to create duplicate accounts and split their own history or paid state.

## Recommended Approach

Add a small "Linked sign-in methods" section to the account page.

Behavior:

1. When the user opens the account page, the app reads the user’s linked identities from Supabase.
2. If Google is not linked, show a `Connect Google` button.
3. Clicking the button starts Supabase manual identity linking for Google.
4. After Google returns, the callback page completes the auth step and redirects the user back to the account page.
5. The account page refreshes linked identities and shows Google as connected.

This keeps the feature local to the account area and avoids spreading linking-specific logic into the main login page.

## UX Design

Add a new card under the existing email/subscription cards on the account page.

Suggested content:

- Title: `로그인 방법` / `Sign-in methods`
- Row 1: `이메일 링크` / `Email link`
- Row 2: `Google`
- Status badge: `연결됨` / `Connected` when linked
- Action button: `Google 연결` / `Connect Google` when not linked

State handling:

- Initial loading: show a muted loading line or disabled button while identities are being fetched
- Already linked: show non-clickable connected state
- Linking in progress: disable the button and change label to a progress message
- Error: show a short friendly message under the card
- Success: show a small success notice after returning to the account page

Important UX rule:

- Do not close the browser tab after successful login or linking.
- The callback page should act as a short-lived processing screen, then automatically move the user to the target page.

## Architecture

### 1. Keep identity-linking state local to the account page

Do not add linked-identity state to the global auth store for this MVP.

Reason:

- only the account page needs this data
- global state would add extra complexity for little product value
- a local fetch is easy to reason about and test

### 2. Add a small account-page identity loader

`AccountClient` should:

- create/read the browser Supabase client
- fetch linked identities after auth loading completes and a user exists
- derive simple booleans such as `isGoogleLinked`

This can live directly in `AccountClient` unless the component starts getting crowded. If it does, extract a small helper or child component.

### 3. Reuse the auth callback page, but make post-success navigation explicit and remove tab-closing behavior

The callback page should support redirecting to a safe internal destination after successful session handling.

For this feature, the desired destination is:

- `/${lang}/account?linked=google`

For normal sign-in, the default destination should become:

- `/${lang}/browse`

This makes the OAuth return behavior understandable and prevents the user from seeing a confusing tab-close experience after a same-tab redirect.

Required callback behavior after success:

- keep the existing processing screen while auth tokens/session are being resolved
- optionally broadcast auth success for cross-tab listeners
- navigate with client-side redirect to the safe destination
- never call `window.close()`

## Data Flow

### Account page load

1. `AuthProvider` resolves session state.
2. `AccountClient` sees a logged-in user.
3. `AccountClient` asks Supabase for linked identities.
4. UI shows whether Google is linked.

### Link Google

1. User clicks `Connect Google`.
2. Frontend calls Supabase manual linking for provider `google`.
3. User is redirected to Google.
4. Google redirects back to the existing auth callback page.
5. Callback page completes session handling.
6. Callback page automatically redirects to the safe account URL.
7. Account page reloads identities and shows Google as connected.

## Error Handling

The UI should handle these cases gently:

- Supabase client missing
  - Show a friendly configuration error and disable linking action.
- Manual linking disabled in Supabase project settings
  - Show a generic "Google connection is not available right now" style message.
- Popup/redirect failure or provider cancellation
  - Return to account page with a short error notice.
- Identity fetch failure
  - Keep the rest of the account page usable and show an inline status message only in the sign-in methods card.

Do not block the entire account page on identity metadata failure.

## Security and Product Constraints

- Manual linking must be enabled in the Supabase Auth settings before this feature can work.
- Redirect targets must stay internal and language-scoped, following the existing redirect sanitization rules.
- The account page must not offer unlinking in MVP, because unlinking has extra safety rules:
  - users must keep at least one sign-in method
  - accidental lockout becomes much easier

## Testing Strategy

Write tests before implementation.

Minimum coverage:

1. Account UI test
   - not linked -> `Connect Google` button is shown
   - linked -> `Connected` status is shown
2. Link action test
   - clicking the button calls the Supabase identity-linking API for Google
3. Callback behavior test
   - successful auth callback redirects to `/[lang]/account?linked=google` when linking flow requested that destination
   - normal auth callback redirects to `/[lang]/browse` by default
   - callback success never attempts to close the tab
4. Failure test
   - identity fetch failure shows inline error without crashing the page

## Implementation Notes

Expected touched areas:

- [`src/app/[lang]/account/AccountClient.tsx`](/Users/macbook/reflix-nextjs/src/app/[lang]/account/AccountClient.tsx)
- [`src/app/[lang]/auth/callback/page.tsx`](/Users/macbook/reflix-nextjs/src/app/[lang]/auth/callback/page.tsx)
- likely related tests for those files

Possible helper:

- extend existing auth redirect utilities if a safe internal post-auth destination helper is needed

## Success Criteria

The MVP is successful when:

- a logged-in email user can connect Google from the account page
- returning from Google lands them back on the account page
- the account page clearly shows Google is linked
- the rest of the login flow still works
- successful login/linking never asks the user to close a tab
- no duplicate-account UX is introduced by the new feature itself

## Open Decisions

These are intentionally fixed for MVP so implementation stays small:

- only Google is supported
- no unlink action yet
- no provider management outside the account page
