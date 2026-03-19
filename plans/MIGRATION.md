# Subscription Infrastructure Migration Plan

## Context

Subscription client code currently lives in `sudojo_client`, making it Sudojo-specific. Since subscription checking is a cross-app concern (sudojo, whisperly, shapeshyft, mixr), this code needs to move to `subscription_lib` as shared infrastructure. Additionally, subscription pages need platform awareness: if a user subscribed on iOS but views on web, they should see their subscription info but be directed to iOS to manage it.

**Apps in scope**: sudojo, whisperly, shapeshyft, mixr (web + RN)
**Apps excluded**: svgr (uses consumables/credits model, not subscriptions)

## Decisions

- Backend returns `platform` in subscription response (detected from RevenueCat store field)
- Backend API for subscription status display; RevenueCat SDK for purchase/upgrade actions
- All APIs use same endpoint path: `/api/v1/users/:userId/subscriptions`
- Cross-platform mismatch: show subscription info + managementUrl link (from RevenueCat SDK)
- New hook uses React Query (`@tanstack/react-query` added as peer dep to subscription_lib)
- subscription_lib hardcodes endpoint path, only `baseUrl` is configurable

---

## Phase 1: Backend — Add platform to subscription responses

### 1.1 Update subscription_service response type

**File**: `/Users/johnhuang/projects/subscription_service/src/types/subscription.ts`
- `SubscriptionInfo.platform` already exists (added earlier) — no change needed

### 1.2 Update sudojo_api to return platform

**File**: `/Users/johnhuang/projects/sudojo_api/src/routes/users.ts` (~line 75)
- Add `platform: subscriptionInfo.platform` to the `subscriptionResult` object
- Currently returns `{ hasSubscription, entitlements, subscriptionStartedAt }` — add `platform`

### 1.3 Add subscription endpoint to whisperly_api

**File**: `/Users/johnhuang/projects/whisperly_api/src/routes/users.ts`
- whisperly_api already depends on `@sudobility/subscription_service` (^1.0.10)
- Add `GET /:userId/subscriptions` route following sudojo_api pattern
- Create subscription middleware (`src/middleware/subscription.ts`) with lazy singleton from `REVENUECAT_API_KEY`
- Response: `{ hasSubscription, entitlements, subscriptionStartedAt, platform }`

### 1.4 Add subscription endpoint to shapeshyft_api

**File**: `/Users/johnhuang/projects/shapeshyft_api/src/routes/users.ts`
- shapeshyft_api already depends on `@sudobility/subscription_service` (^1.0.10)
- Add `GET /:userId/subscriptions` route (same pattern)
- Create subscription middleware if not already present

### 1.5 Add subscription endpoint to mixr_api

**File**: `/Users/johnhuang/projects/mixr_api/src/routes/users.ts`
- Add `@sudobility/subscription_service` as dependency: `bun add @sudobility/subscription_service`
- Add `GET /:userId/subscriptions` route (same pattern)
- Create subscription middleware
- Ensure `REVENUECAT_API_KEY` is in `.env` / env config

---

## Phase 2: Shared types — Define BackendSubscriptionResult

### 2.1 Add type in subscription_lib

**New file**: `/Users/johnhuang/projects/subscription_lib/src/backend/types.ts`

```typescript
import type { SubscriptionPlatform } from '@sudobility/types';

export interface BackendSubscriptionResult {
  hasSubscription: boolean;
  entitlements: string[];
  platform: SubscriptionPlatform | null;
  subscriptionStartedAt: string | null;
}
```

- `entitlements` is `string[]` (not `RevenueCatEntitlement[]` — backend returns plain strings)
- `subscriptionStartedAt` is `string | null` (ISO 8601 from JSON)
- `platform` uses `SubscriptionPlatform` from `@sudobility/types` (already a peer dep)

---

## Phase 3: subscription_lib — Add backend client

### 3.1 Pure fetch function

**New file**: `/Users/johnhuang/projects/subscription_lib/src/backend/fetch-backend-subscription.ts`

```typescript
import type { NetworkClient } from '@sudobility/types';
import type { BackendSubscriptionResult } from './types';

export async function fetchBackendSubscription(
  networkClient: NetworkClient,
  baseUrl: string,
  token: string,
  userId: string,
  testMode?: boolean
): Promise<BackendSubscriptionResult>
```

- Validates userId (1-128 chars)
- Calls `GET {baseUrl}/api/v1/users/{userId}/subscriptions?testMode=true` (if testMode)
- Bearer token auth via `Authorization` header
- Uses `networkClient.get()` from `@sudobility/types`
- Unwraps `BaseResponse<BackendSubscriptionResult>` — returns inner `.data`
- Throws on error responses

### 3.2 React Query hook

**New file**: `/Users/johnhuang/projects/subscription_lib/src/backend/use-backend-subscription.ts`

```typescript
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { NetworkClient } from '@sudobility/types';
import type { BackendSubscriptionResult } from './types';
import { fetchBackendSubscription } from './fetch-backend-subscription';

export function useBackendSubscription(
  networkClient: NetworkClient,
  baseUrl: string,
  token: string,
  userId: string,
  testMode?: boolean,
  options?: Omit<UseQueryOptions<BackendSubscriptionResult>, 'queryKey' | 'queryFn'>
): UseQueryResult<BackendSubscriptionResult>
```

- Query key: `['subscription', 'backend', userId]`
- Stale time: 2 minutes (matches sudojo_client pattern)
- Auto-disabled when `!token || !userId`
- Uses `useQuery` from `@tanstack/react-query`

### 3.3 Barrel exports

**New file**: `/Users/johnhuang/projects/subscription_lib/src/backend/index.ts`
- Export `BackendSubscriptionResult`, `fetchBackendSubscription`, `useBackendSubscription`

**Modify**: `/Users/johnhuang/projects/subscription_lib/src/index.ts`
- Add `export { ... } from './backend'`

### 3.4 Update package.json

**File**: `/Users/johnhuang/projects/subscription_lib/package.json`
- Add peer dep: `"@tanstack/react-query": "^5.0.0"` (or `^4.0.0 || ^5.0.0` based on what apps use)
- Add dev dep: `"@tanstack/react-query": "^5.0.0"` (for development/testing)
- `@sudobility/types` already provides `NetworkClient` and `BaseResponse` — no new dep needed

### 3.5 Tests

**New file**: `/Users/johnhuang/projects/subscription_lib/src/backend/fetch-backend-subscription.test.ts`
- Test successful fetch, userId validation, testMode query param, error handling, auth header

---

## Phase 4: subscription_pages — Add platform awareness

### 4.1 Add currentPlatform prop and backend subscription data

**Modify**: `/Users/johnhuang/projects/subscription_pages/src/pages/SubscriptionByDurationPage.tsx`
**Modify**: `/Users/johnhuang/projects/subscription_pages/src/pages/SubscriptionByOfferPage.tsx`

New props:
```typescript
interface SubscriptionPageProps {
  // ... existing props (isLoggedIn, onNavigateToLogin, userId, userEmail, freeFeatures, title)
  currentPlatform?: SubscriptionPlatform;  // always 'web' for web pages
  networkClient?: NetworkClient;           // for backend subscription fetch
  baseUrl?: string;                        // backend API base URL
  token?: string;                          // auth token
  testMode?: boolean;                      // sandbox mode
}
```

- `currentPlatform` defaults to `SubscriptionPlatform.Web` for web
- Props are optional to avoid breaking existing consumers without backend integration
- When `networkClient` + `baseUrl` + `token` + `userId` are all provided, call `useBackendSubscription()`

### 4.2 Platform mismatch logic

In both page components, after fetching backend subscription:

```typescript
const backendSub = useBackendSubscription(networkClient, baseUrl, token, userId, testMode);
const subscriptionPlatform = backendSub.data?.platform ?? null;
const isPlatformMatch = !subscriptionPlatform || subscriptionPlatform === currentPlatform;
```

- If `isPlatformMatch === true`: keep current UX (purchase/upgrade/downgrade/cancel)
- If `isPlatformMatch === false`: show subscription info + "Manage your subscription on {platform}" message with managementUrl link (from `useUserSubscription().subscription?.managementUrl`)

### 4.3 Cross-platform info component

**New file**: `/Users/johnhuang/projects/subscription_pages/src/components/CrossPlatformSubscriptionInfo.tsx`

Shows when platform mismatch detected:
- Current plan name, entitlements, expiration
- "Your subscription was purchased on {iOS/Android/macOS/Web}"
- "To manage your subscription, visit your {platform} settings" with managementUrl link (if available)
- No purchase/upgrade/cancel buttons

### 4.4 Update peer dependencies

**File**: `/Users/johnhuang/projects/subscription_pages/package.json`
- Bump `@sudobility/subscription_lib` peer dep to version with backend client
- Add `@sudobility/types` peer dep if not already present (for `NetworkClient`, `SubscriptionPlatform`)

---

## Phase 5: subscription_pages_rn — Add platform awareness

### 5.1 Add currentPlatform prop

**Modify**: `/Users/johnhuang/projects/subscription_pages_rn/src/pages/SubscriptionByDurationPage.tsx`

New props:
```typescript
interface SubscriptionByDurationPageProps {
  // ... existing props (userId, freeFeatures, title, onPurchaseSuccess, onRestoreSuccess)
  currentPlatform: SubscriptionPlatform;   // passed in: ios, android, or macos
  networkClient?: NetworkClient;
  baseUrl?: string;
  token?: string;
  testMode?: boolean;
}
```

- `currentPlatform` is **required** on RN (unlike web where it defaults to Web)

### 5.2 Platform mismatch logic

Same logic as web version — show `CrossPlatformSubscriptionInfo` (RN variant) when platforms don't match.

**New file**: `/Users/johnhuang/projects/subscription_pages_rn/src/components/CrossPlatformSubscriptionInfo.tsx`
- RN version using `View`, `Text`, `TouchableOpacity`, `Linking.openURL(managementUrl)`

### 5.3 Update peer dependencies

Same as web: bump subscription_lib, ensure @sudobility/types is a peer dep.

---

## Phase 6: App integration

### 6.1 Apps already using subscription_pages (update props)

**sudojo_app** — `/Users/johnhuang/projects/sudojo_app/src/pages/SubscriptionPage.tsx`
- Add `currentPlatform={SubscriptionPlatform.Web}`, `networkClient`, `baseUrl`, `token` props

**sudojo_app_rn** — `/Users/johnhuang/projects/sudojo_app_rn/src/screens/SubscriptionScreen.tsx`
- Add `currentPlatform={Platform.OS === 'ios' ? SubscriptionPlatform.iOS : SubscriptionPlatform.Android}`, `networkClient`, `baseUrl`, `token` props

**whisperly_app** — `/Users/johnhuang/projects/whisperly_app/src/pages/Subscription.tsx`
- Add same props as sudojo_app (web)

**shapeshyft_app** — `/Users/johnhuang/projects/shapeshyft_app/src/pages/dashboard/SubscriptionPage.tsx`
- Add same props as sudojo_app (web)

### 6.2 Apps needing new subscription pages

**mixr** (web) — `/Users/johnhuang/projects/mixr/`
- Create `src/pages/SubscriptionPage.tsx` with `SubscriptionByDurationPage`
- Add route in App.tsx
- Add dependencies: `@sudobility/subscription_pages`, `@sudobility/subscription_lib`, `@sudobility/subscription-components`, `@revenuecat/purchases-js`
- Initialize subscription_lib in app providers (adapter, free tier config)

**mixr_app_rn** — `/Users/johnhuang/projects/mixr_app_rn/`
- Create `src/screens/SubscriptionScreen.tsx` with `SubscriptionByDurationPage`
- Add to navigation stack
- Add dependencies: `@sudobility/subscription_pages_rn`, `@sudobility/subscription_lib`, `@sudobility/subscription-components-rn`, `react-native-purchases`
- Initialize subscription_lib in app providers

### 6.3 Deprecate sudojo_client subscription code

**File**: `/Users/johnhuang/projects/sudojo_client/src/hooks/use-sudojo-users.ts`
- Mark `useSudojoUserSubscription` as `@deprecated` — point to `@sudobility/subscription_lib`

**File**: `/Users/johnhuang/projects/sudojo_client/src/network/sudojo-client.ts`
- Mark `getUserSubscription()` as `@deprecated`

**File**: `/Users/johnhuang/projects/sudojo_types/src/index.ts`
- Mark `SubscriptionResult` and `RevenueCatEntitlement` as `@deprecated`

---

## Execution Order

```
Phase 1 (Backend APIs)          — can be done in parallel across all 4 APIs
  ↓
Phase 2 (Shared types)          — depends on nothing
  ↓
Phase 3 (subscription_lib)      — depends on Phase 2
  ↓
Phase 4 + 5 (subscription_pages + _rn) — depends on Phase 3, can be done in parallel
  ↓
Phase 6 (App integration)       — depends on Phases 4+5, apps can be done in parallel
```

Phases 1 and 2+3 can be done in parallel since they don't depend on each other.

## Verification

After each phase, run in the modified project:
```bash
bun run build && bun run typecheck && bun test && bun run lint
```

End-to-end verification:
1. Start sudojo_api locally, call `GET /api/v1/users/:userId/subscriptions` — verify `platform` is in response
2. In sudojo_app, verify subscription page shows current plan with platform info
3. Test cross-platform scenario: subscribe on web, then check subscription_pages_rn — should show "manage on web" message
4. Test same-platform scenario: subscribe on web, view on web — should show full purchase/upgrade/cancel UX
5. Verify mixr web + RN subscription pages render and fetch data correctly

## Key Files Reference

| Purpose | File |
|---------|------|
| subscription_service types | `/Users/johnhuang/projects/subscription_service/src/types/subscription.ts` |
| sudojo_api subscription route (reference) | `/Users/johnhuang/projects/sudojo_api/src/routes/users.ts` |
| sudojo_api subscription middleware | `/Users/johnhuang/projects/sudojo_api/src/middleware/subscription.ts` |
| subscription_lib index | `/Users/johnhuang/projects/subscription_lib/src/index.ts` |
| subscription_lib useUserSubscription (pattern) | `/Users/johnhuang/projects/subscription_lib/src/hooks/useUserSubscription.ts` |
| sudojo_client getUserSubscription (code to move) | `/Users/johnhuang/projects/sudojo_client/src/network/sudojo-client.ts` (~line 900) |
| sudojo_client hook (code to move) | `/Users/johnhuang/projects/sudojo_client/src/hooks/use-sudojo-users.ts` (~line 91) |
| NetworkClient interface | `/Users/johnhuang/projects/types/src/types/infrastructure/network.ts` |
| BaseResponse type | `/Users/johnhuang/projects/types/src/types/common.ts` |
| SubscriptionPlatform enum | `/Users/johnhuang/projects/types/src/types/subscription/platform.ts` |
| subscription_pages ByDuration | `/Users/johnhuang/projects/subscription_pages/src/pages/SubscriptionByDurationPage.tsx` |
| subscription_pages_rn ByDuration | `/Users/johnhuang/projects/subscription_pages_rn/src/pages/SubscriptionByDurationPage.tsx` |
| sudojo_app subscription page | `/Users/johnhuang/projects/sudojo_app/src/pages/SubscriptionPage.tsx` |
| sudojo_app_rn subscription screen | `/Users/johnhuang/projects/sudojo_app_rn/src/screens/SubscriptionScreen.tsx` |
| whisperly_app subscription page | `/Users/johnhuang/projects/whisperly_app/src/pages/Subscription.tsx` |
| shapeshyft_app subscription page | `/Users/johnhuang/projects/shapeshyft_app/src/pages/dashboard/SubscriptionPage.tsx` |
