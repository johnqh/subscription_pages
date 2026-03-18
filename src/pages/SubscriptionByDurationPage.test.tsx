import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubscriptionByDurationPage } from './SubscriptionByDurationPage';
import type { SubscriptionPeriod } from '@sudobility/types';

// Mock subscription_lib
const mockUsePackagesByDuration = vi.fn();
const mockUseUserSubscription = vi.fn();
const mockGetSubscriptionInstance = vi.fn();
const mockRefreshSubscription = vi.fn();

vi.mock('@sudobility/subscription_lib', () => ({
  usePackagesByDuration: () => mockUsePackagesByDuration(),
  useUserSubscription: () => mockUseUserSubscription(),
  getSubscriptionInstance: () => mockGetSubscriptionInstance(),
  refreshSubscription: () => mockRefreshSubscription(),
}));

// Mock subscription-components
const MockSubscriptionLayout = vi.fn(
  ({
    title,
    children,
    error,
    aboveProducts,
    freeTileConfig,
    currentStatus,
  }: any) => (
    <div data-testid="subscription-layout">
      <h1>{title}</h1>
      {error && <div data-testid="error">{error}</div>}
      {currentStatus?.isActive && (
        <div data-testid="current-status">
          {currentStatus.activeContent?.title}
          {currentStatus.activeContent?.fields?.map(
            (f: { label: string; value: string }) => (
              <span key={f.label}>
                {f.label}: {f.value}
              </span>
            )
          )}
        </div>
      )}
      {aboveProducts && (
        <div data-testid="above-products">{aboveProducts}</div>
      )}
      {freeTileConfig && (
        <div data-testid="free-tile">
          <span>{freeTileConfig.title}</span>
          <button onClick={freeTileConfig.ctaButton.onClick}>
            {freeTileConfig.ctaButton.label}
          </button>
          {freeTileConfig.topBadge && (
            <span data-testid="free-badge">{freeTileConfig.topBadge.text}</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
);

const MockSubscriptionTile = vi.fn(
  ({ id, title, ctaButton, isCurrentPlan, disabled }: any) => (
    <div data-testid={`tile-${id}`}>
      <span>{title}</span>
      {isCurrentPlan && <span data-testid="current-plan-badge">Current</span>}
      {ctaButton && (
        <button
          onClick={ctaButton.onClick}
          disabled={disabled}
          data-testid={`cta-${id}`}
        >
          {ctaButton.label}
        </button>
      )}
    </div>
  )
);

const MockSegmentedControl = vi.fn(
  ({ options, value, onChange }: any) => (
    <div data-testid="segmented-control">
      {options.map((opt: { value: string; label: string }) => (
        <button
          key={opt.value}
          data-testid={`segment-${opt.value}`}
          data-selected={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
);

vi.mock('@sudobility/subscription-components', () => ({
  SubscriptionLayout: (props: any) => MockSubscriptionLayout(props),
  SubscriptionTile: (props: any) => MockSubscriptionTile(props),
  SegmentedControl: (props: any) => MockSegmentedControl(props),
}));

const makePackageWithOffer = (
  packageId: string,
  name: string,
  period: SubscriptionPeriod,
  priceString: string,
  offerId: string
) => ({
  package: {
    packageId,
    name,
    product: {
      productId: packageId,
      name,
      price: parseFloat(priceString.replace('$', '')),
      priceString,
      currency: 'USD',
      period,
      periodDuration: period === 'monthly' ? 'P1M' : 'P1Y',
    },
    entitlements: ['pro'],
  },
  offerId,
});

describe('SubscriptionByDurationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshSubscription.mockResolvedValue(undefined);
  });

  it('shows loading state', () => {
    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: {},
      availableDurations: [],
      isLoading: true,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: true,
      error: null,
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
      />
    );

    expect(screen.getByText('Loading subscription plans...')).toBeTruthy();
  });

  it('shows error state', () => {
    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: {},
      availableDurations: [],
      isLoading: false,
      error: new Error('Network error'),
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
      />
    );

    expect(screen.getByTestId('error').textContent).toBe('Network error');
  });

  it('shows "Try it for Free" and "Log in to Continue" when not logged in', () => {
    const monthlyPkg = makePackageWithOffer(
      'pro_monthly',
      'Pro Monthly',
      'monthly',
      '$9.99',
      'default'
    );

    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: { monthly: [monthlyPkg] },
      availableDurations: ['monthly'] as SubscriptionPeriod[],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    const onNavigateToLogin = vi.fn();

    render(
      <SubscriptionByDurationPage
        isLoggedIn={false}
        onNavigateToLogin={onNavigateToLogin}
      />
    );

    // Free tile CTA
    const freeTileButton = screen.getByText('Try it for Free');
    expect(freeTileButton).toBeTruthy();
    fireEvent.click(freeTileButton);
    expect(onNavigateToLogin).toHaveBeenCalledTimes(1);

    // Paid tile CTA
    const loginButton = screen.getByText('Log in to Continue');
    expect(loginButton).toBeTruthy();
    fireEvent.click(loginButton);
    expect(onNavigateToLogin).toHaveBeenCalledTimes(2);
  });

  it('shows "Current Plan" badge on free tile when logged in with no subscription', () => {
    const monthlyPkg = makePackageWithOffer(
      'pro_monthly',
      'Pro Monthly',
      'monthly',
      '$9.99',
      'default'
    );

    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: { monthly: [monthlyPkg] },
      availableDurations: ['monthly'] as SubscriptionPeriod[],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    expect(screen.getByTestId('free-badge').textContent).toBe('Current Plan');
    expect(screen.getByText('Subscribe')).toBeTruthy();
  });

  it('shows current subscription status and isCurrentPlan on matching tile', () => {
    const monthlyPkg = makePackageWithOffer(
      'pro_monthly',
      'Pro Monthly',
      'monthly',
      '$9.99',
      'default'
    );

    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: { monthly: [monthlyPkg] },
      availableDurations: ['monthly'] as SubscriptionPeriod[],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: {
        isActive: true,
        packageId: 'pro_monthly',
        productId: 'pro_monthly',
        entitlements: ['pro'],
        period: 'monthly',
        expirationDate: new Date('2026-04-17'),
        willRenew: true,
      },
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    expect(screen.getByTestId('current-status')).toBeTruthy();
    expect(screen.getByText('Active Subscription')).toBeTruthy();
    // Current plan tile should not have a CTA button
    expect(screen.queryByTestId('cta-pro_monthly')).toBeNull();
    expect(screen.getByTestId('current-plan-badge')).toBeTruthy();
  });

  it('shows "Change Subscription" when logged in with different subscription', () => {
    const yearlyPkg = makePackageWithOffer(
      'pro_yearly',
      'Pro Yearly',
      'yearly',
      '$99.99',
      'default'
    );

    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: { yearly: [yearlyPkg] },
      availableDurations: ['yearly'] as SubscriptionPeriod[],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: {
        isActive: true,
        packageId: 'pro_monthly',
        productId: 'pro_monthly',
        entitlements: ['pro'],
        period: 'monthly',
      },
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    expect(screen.getByText('Change Subscription')).toBeTruthy();
  });

  it('handles purchase flow', async () => {
    const monthlyPkg = makePackageWithOffer(
      'pro_monthly',
      'Pro Monthly',
      'monthly',
      '$9.99',
      'default'
    );

    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: { monthly: [monthlyPkg] },
      availableDurations: ['monthly'] as SubscriptionPeriod[],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    const mockPurchase = vi.fn().mockResolvedValue(undefined);
    mockGetSubscriptionInstance.mockReturnValue({
      purchase: mockPurchase,
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
        userEmail="test@test.com"
      />
    );

    fireEvent.click(screen.getByText('Subscribe'));

    await waitFor(() => {
      expect(mockPurchase).toHaveBeenCalledWith({
        packageId: 'pro_monthly',
        offeringId: 'default',
        customerEmail: 'test@test.com',
      });
    });
    expect(mockRefreshSubscription).toHaveBeenCalled();
  });

  it('handles purchase error', async () => {
    const monthlyPkg = makePackageWithOffer(
      'pro_monthly',
      'Pro Monthly',
      'monthly',
      '$9.99',
      'default'
    );

    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: { monthly: [monthlyPkg] },
      availableDurations: ['monthly'] as SubscriptionPeriod[],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    mockGetSubscriptionInstance.mockReturnValue({
      purchase: vi.fn().mockRejectedValue(new Error('Payment declined')),
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    fireEvent.click(screen.getByText('Subscribe'));

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Payment declined');
    });
  });

  it('renders segmented control with multiple durations', () => {
    const monthlyPkg = makePackageWithOffer(
      'pro_monthly',
      'Pro Monthly',
      'monthly',
      '$9.99',
      'default'
    );
    const yearlyPkg = makePackageWithOffer(
      'pro_yearly',
      'Pro Yearly',
      'yearly',
      '$99.99',
      'default'
    );

    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: {
        monthly: [monthlyPkg],
        yearly: [yearlyPkg],
      },
      availableDurations: ['monthly', 'yearly'] as SubscriptionPeriod[],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
      />
    );

    expect(screen.getByTestId('segmented-control')).toBeTruthy();
    expect(screen.getByTestId('segment-monthly')).toBeTruthy();
    expect(screen.getByTestId('segment-yearly')).toBeTruthy();
  });

  it('switches duration on segment click', () => {
    const monthlyPkg = makePackageWithOffer(
      'pro_monthly',
      'Pro Monthly',
      'monthly',
      '$9.99',
      'default'
    );
    const yearlyPkg = makePackageWithOffer(
      'pro_yearly',
      'Pro Yearly',
      'yearly',
      '$99.99',
      'default'
    );

    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: {
        monthly: [monthlyPkg],
        yearly: [yearlyPkg],
      },
      availableDurations: ['monthly', 'yearly'] as SubscriptionPeriod[],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
      />
    );

    // Initially shows monthly
    expect(screen.getByTestId('tile-pro_monthly')).toBeTruthy();

    // Switch to yearly
    fireEvent.click(screen.getByTestId('segment-yearly'));

    expect(screen.getByTestId('tile-pro_yearly')).toBeTruthy();
  });

  it('uses custom title', () => {
    mockUsePackagesByDuration.mockReturnValue({
      packagesByDuration: {},
      availableDurations: [],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByDurationPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
        title="Pricing Plans"
      />
    );

    expect(screen.getByText('Pricing Plans')).toBeTruthy();
  });
});
