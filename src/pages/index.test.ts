import { describe, it, expect, vi } from 'vitest';

// Mock transitive dependencies to avoid module resolution issues
vi.mock('@sudobility/subscription_lib', () => ({
  usePackagesByDuration: vi.fn(),
  useAllOfferings: vi.fn(),
  useOfferingPackages: vi.fn(),
  useUserSubscription: vi.fn(),
  getSubscriptionInstance: vi.fn(),
  refreshSubscription: vi.fn(),
}));

vi.mock('@sudobility/subscription-components', () => ({
  SubscriptionLayout: vi.fn(),
  SubscriptionTile: vi.fn(),
  SegmentedControl: vi.fn(),
}));

import { SubscriptionByDurationPage, SubscriptionByOfferPage } from './index';

describe('pages/index exports', () => {
  it('exports SubscriptionByDurationPage', () => {
    expect(SubscriptionByDurationPage).toBeDefined();
    expect(typeof SubscriptionByDurationPage).toBe('function');
  });

  it('exports SubscriptionByOfferPage', () => {
    expect(SubscriptionByOfferPage).toBeDefined();
    expect(typeof SubscriptionByOfferPage).toBe('function');
  });
});
