# @sudobility/subscription_pages

Subscription page components for React web applications.

## Installation

```bash
bun add @sudobility/subscription_pages
```

## Usage

```tsx
import {
  SubscriptionByDurationPage,
  SubscriptionByOfferPage,
} from '@sudobility/subscription_pages';

// Duration-based: tabs for monthly/yearly
<SubscriptionByDurationPage
  isLoggedIn={!!user}
  onNavigateToLogin={() => navigate('/login')}
  userId={user?.uid}
  userEmail={user?.email}
  featuresByPackage={{
    pro_monthly: ['Unlimited projects', 'Priority support'],
    pro_yearly: ['Unlimited projects', 'Priority support', 'Save 20%'],
  }}
  freeFeatures={['3 projects', 'Community support']}
/>

// Offer-based: tabs for free/basic/premium
<SubscriptionByOfferPage
  isLoggedIn={!!user}
  onNavigateToLogin={() => navigate('/login')}
  userId={user?.uid}
  userEmail={user?.email}
  featuresByPackage={{
    basic_monthly: ['10 projects'],
    premium_monthly: ['Unlimited projects', 'Priority support'],
  }}
  freeFeatures={['3 projects']}
/>
```

## API

### SubscriptionByDurationPage

Groups packages by billing period (monthly, yearly, etc.) with a segmented control to switch.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isLoggedIn` | `boolean` | Yes | Whether user is logged in |
| `onNavigateToLogin` | `() => void` | Yes | Login navigation callback |
| `userId` | `string` | No | User ID for subscription lookup |
| `userEmail` | `string` | No | User email for purchase operations |
| `featuresByPackage` | `Record<string, string[]>` | No | Features per package ID |
| `freeFeatures` | `string[]` | No | Features for the free tier |
| `title` | `string` | No | Page title (default: "Choose Your Plan") |
| `className` | `string` | No | Additional CSS classes |

### SubscriptionByOfferPage

Organizes packages by offering with a segmented control (Free, then each offering).

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isLoggedIn` | `boolean` | Yes | Whether user is logged in |
| `onNavigateToLogin` | `() => void` | Yes | Login navigation callback |
| `userId` | `string` | No | User ID for subscription lookup |
| `userEmail` | `string` | No | User email for purchase operations |
| `featuresByPackage` | `Record<string, string[]>` | No | Features per package ID |
| `freeFeatures` | `string[]` | No | Features for the free tier |
| `title` | `string` | No | Page title (default: "Choose Your Plan") |
| `className` | `string` | No | Additional CSS classes |

## Peer Dependencies

- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `@sudobility/subscription_lib` >= 0.0.25
- `@sudobility/subscription-components` >= 1.0.27
- `@sudobility/types` >= 1.9.58

## Development

```bash
bun run build        # Build to dist/
bun run type-check   # TypeScript check (note: hyphenated)
bun run lint         # ESLint
bun test             # Run tests
```

## License

BUSL-1.1
