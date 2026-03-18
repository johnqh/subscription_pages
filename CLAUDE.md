# Subscription Pages - AI Development Guide

## Overview

Web page components for subscription management in React applications. Composes hooks from `@sudobility/subscription_lib` with UI components from `@sudobility/subscription-components` to provide ready-to-use subscription pages.

- **Package**: `@sudobility/subscription_pages`
- **Version**: 0.0.1
- **License**: BUSL-1.1
- **Package Manager**: Bun

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Bun
- **Build**: Vite library mode (ESM) + tsc declarations
- **UI**: React, @sudobility/subscription-components
- **Data**: @sudobility/subscription_lib hooks
- **Testing**: Vitest + React Testing Library

## Project Structure

```
src/
├── index.ts          # Public exports
└── pages/
    ├── index.ts                          # Page exports
    ├── SubscriptionByDurationPage.tsx     # Group packages by billing period
    ├── SubscriptionByDurationPage.test.tsx
    ├── SubscriptionByOfferPage.tsx        # Group packages by offering
    ├── SubscriptionByOfferPage.test.tsx
    └── index.test.ts
```

## Key Exports

| Export | Description |
|--------|-------------|
| `SubscriptionByDurationPage` | Subscription page with duration-based segmented control (monthly/yearly) |
| `SubscriptionByDurationPageProps` | Props interface for SubscriptionByDurationPage |
| `SubscriptionByOfferPage` | Subscription page with offering-based segmented control (free/basic/premium) |
| `SubscriptionByOfferPageProps` | Props interface for SubscriptionByOfferPage |

## Commands

```bash
bun install          # Install dependencies
bun run build        # tsc + vite build to dist/
bun run dev          # Vite watch mode
bun run type-check   # TypeScript check (note: hyphenated)
bun run lint         # ESLint
bun run lint:fix     # ESLint auto-fix
bun run format       # Prettier
bun test             # Run tests (vitest run)
bun run test:watch   # Watch mode tests
```

## Peer Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` / `react-dom` | ^18.0.0 or ^19.0.0 | UI framework |
| `@sudobility/subscription_lib` | ^0.0.25 | Subscription hooks (usePackagesByDuration, useAllOfferings, etc.) |
| `@sudobility/subscription-components` | ^1.0.27 | UI components (SubscriptionLayout, SubscriptionTile, SegmentedControl) |
| `@sudobility/types` | ^1.9.58 | Shared types (SubscriptionPeriod) |

## Coding Patterns

### Page Composition

Pages compose subscription_lib hooks with subscription-components UI:
```typescript
export function SubscriptionByDurationPage(props: Props) {
  const { packagesByDuration, availableDurations } = usePackagesByDuration();
  const { subscription } = useUserSubscription({ userId, userEmail });

  return (
    <SubscriptionLayout variant="cta" ...>
      <SegmentedControl ... />
      {packages.map(pkg => <SubscriptionTile ... />)}
    </SubscriptionLayout>
  );
}
```

### CTA Logic

Both pages follow the same CTA pattern based on auth + subscription state:
- Not logged in: "Try it for Free" / "Log in to Continue" -> onNavigateToLogin
- Logged in, no sub: Free is current plan; paid tiles show "Subscribe"
- Logged in, has sub: Current plan marked; others show "Change Subscription"; free shows "Cancel Subscription"

### Purchase Flow

Uses `getSubscriptionInstance().purchase()` then `refreshSubscription()` from subscription_lib singleton.

## Related Projects

```
subscription_pages (this package)
    ├── subscription_lib (data hooks + singleton)
    └── subscription-components (UI components)
        ^
consuming apps (import pages directly)
```

## Gotchas

- **Typecheck command is `type-check` (hyphenated)** -- `bun run typecheck` will silently do nothing.
- **Vite library mode build** -- produces ESM only. Build is `tsc && vite build`, not just `tsc`.
- **useOfferingPackages always called** -- In SubscriptionByOfferPage, the hook is always called (hooks can't be conditional) with a fallback offerId when 'free' is selected.
- **5 peer dependencies required** -- Missing any causes confusing build errors in consumers.

## Pre-Commit Checklist

```bash
bun run type-check && bun run lint && bun test && bun run build
```
