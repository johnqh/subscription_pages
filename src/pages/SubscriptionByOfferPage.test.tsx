import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubscriptionByOfferPage } from './SubscriptionByOfferPage';

// Mock subscription_lib
const mockUseAllOfferings = vi.fn();
const mockUseOfferingPackages = vi.fn();
const mockUseUserSubscription = vi.fn();
const mockGetSubscriptionInstance = vi.fn();
const mockRefreshSubscription = vi.fn();

vi.mock('@sudobility/subscription_lib', () => ({
  useAllOfferings: () => mockUseAllOfferings(),
  useOfferingPackages: () => mockUseOfferingPackages(),
  useUserSubscription: () => mockUseUserSubscription(),
  getSubscriptionInstance: () => mockGetSubscriptionInstance(),
  refreshSubscription: () => mockRefreshSubscription(),
  periodToMonths: (period: string) => {
    const map: Record<string, number> = {
      weekly: 0.25,
      monthly: 1,
      quarterly: 3,
      yearly: 12,
      lifetime: Infinity,
    };
    return map[period] ?? 1;
  },
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
  SegmentedControl: (props: any) => MockSegmentedControl(props),
}));

const mockOfferings = [
  {
    offerId: 'basic',
    metadata: {},
    packages: [
      {
        packageId: 'basic_monthly',
        name: 'Basic Monthly',
        product: {
          productId: 'basic_monthly',
          name: 'Basic Monthly',
          price: 4.99,
          priceString: '$4.99',
          currency: 'USD',
          period: 'monthly' as const,
          periodDuration: 'P1M',
        },
        entitlements: ['basic'],
      },
    ],
  },
  {
    offerId: 'premium',
    metadata: {},
    packages: [
      {
        packageId: 'premium_monthly',
        name: 'Premium Monthly',
        product: {
          productId: 'premium_monthly',
          name: 'Premium Monthly',
          price: 9.99,
          priceString: '$9.99',
          currency: 'USD',
          period: 'monthly' as const,
          periodDuration: 'P1M',
        },
        entitlements: ['premium'],
      },
    ],
  },
];

describe('SubscriptionByOfferPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshSubscription.mockResolvedValue(undefined);
  });

  it('shows loading state', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: [],
      isLoading: true,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: [],
      isLoading: true,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: true,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
      />
    );

    expect(screen.getByText('Loading subscription plans...')).toBeTruthy();
  });

  it('shows error state', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: [],
      isLoading: false,
      error: new Error('Failed to load'),
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: [],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
      />
    );

    expect(screen.getByTestId('error').textContent).toBe('Failed to load');
  });

  it('shows free tile with "Try it for Free" when not logged in', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: [],
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
      <SubscriptionByOfferPage
        isLoggedIn={false}
        onNavigateToLogin={onNavigateToLogin}
        freeFeatures={['Basic feature']}
      />
    );

    // Default segment is 'free', so free tile should show
    const tryFreeButton = screen.getByText('Try it for Free');
    expect(tryFreeButton).toBeTruthy();
    fireEvent.click(tryFreeButton);
    expect(onNavigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('shows "Current Plan" on free tile when logged in without subscription', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: [],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    expect(screen.getByTestId('free-badge').textContent).toBe('Current Plan');
  });

  it('shows segmented control with free and offering segments', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: [],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
      />
    );

    expect(screen.getByTestId('segment-free')).toBeTruthy();
    expect(screen.getByTestId('segment-basic')).toBeTruthy();
    expect(screen.getByTestId('segment-premium')).toBeTruthy();
  });

  it('shows duration list when switching to an offering segment', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: mockOfferings[0].packages,
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
      <SubscriptionByOfferPage
        isLoggedIn={false}
        onNavigateToLogin={onNavigateToLogin}
      />
    );

    // Switch to 'basic' offering
    fireEvent.click(screen.getByTestId('segment-basic'));

    // Shows period label and login CTA with price
    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText('$4.99 · Log in to Continue')).toBeTruthy();
  });

  it('shows "Subscribe" CTAs when logged in without subscription', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: mockOfferings[0].packages,
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    // Switch to offering
    fireEvent.click(screen.getByTestId('segment-basic'));

    expect(screen.getByText('$4.99 · Subscribe')).toBeTruthy();
  });

  it('shows current subscription status', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: mockOfferings[0].packages,
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: {
        isActive: true,
        packageId: 'basic_monthly',
        productId: 'basic_monthly',
        entitlements: ['basic'],
        period: 'monthly',
        expirationDate: new Date('2026-04-17'),
        willRenew: true,
      },
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    expect(screen.getByTestId('current-status')).toBeTruthy();
    expect(screen.getByText('Active Subscription')).toBeTruthy();
  });

  it('marks current plan in the list', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: mockOfferings[0].packages,
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: {
        isActive: true,
        packageId: 'basic_monthly',
        productId: 'basic_monthly',
        entitlements: ['basic'],
        period: 'monthly',
      },
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    // Switch to basic offering
    fireEvent.click(screen.getByTestId('segment-basic'));

    // Current plan shows "Current Plan" as both subtitle and button label
    expect(screen.getAllByText('Current Plan').length).toBeGreaterThanOrEqual(1);
  });

  it('handles purchase flow', async () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: mockOfferings[0].packages,
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
      <SubscriptionByOfferPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
        userEmail="test@test.com"
      />
    );

    // Switch to basic offering
    fireEvent.click(screen.getByTestId('segment-basic'));

    fireEvent.click(screen.getByText('$4.99 · Subscribe'));

    await waitFor(() => {
      expect(mockPurchase).toHaveBeenCalledWith({
        packageId: 'basic_monthly',
        offeringId: 'basic',
        customerEmail: 'test@test.com',
      });
    });
    expect(mockRefreshSubscription).toHaveBeenCalled();
  });

  it('handles purchase error', async () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: mockOfferings[0].packages,
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    mockGetSubscriptionInstance.mockReturnValue({
      purchase: vi.fn().mockRejectedValue(new Error('Payment failed')),
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    // Switch to basic offering
    fireEvent.click(screen.getByTestId('segment-basic'));

    fireEvent.click(screen.getByText('$4.99 · Subscribe'));

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe('Payment failed');
    });
  });

  it('uses custom title', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: [],
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: [],
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
        title="Select a Plan"
      />
    );

    expect(screen.getByText('Select a Plan')).toBeTruthy();
  });

  it('shows "Change Subscription" when logged in with different subscription', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: mockOfferings[1].packages,
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: {
        isActive: true,
        packageId: 'basic_monthly',
        productId: 'basic_monthly',
        entitlements: ['basic'],
        period: 'monthly',
      },
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    // Switch to premium offering
    fireEvent.click(screen.getByTestId('segment-premium'));

    expect(screen.getByText('$9.99 · Change Subscription')).toBeTruthy();
  });

  it('renders offering content when renderOfferingContent is provided', () => {
    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: mockOfferings[0].packages,
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={false}
        onNavigateToLogin={() => {}}
        renderOfferingContent={(offerId) => (
          <p data-testid="offering-content">Features for {offerId}</p>
        )}
      />
    );

    // Switch to basic offering
    fireEvent.click(screen.getByTestId('segment-basic'));

    expect(screen.getByTestId('offering-content').textContent).toBe(
      'Features for basic'
    );
  });

  it('shows savings for longer duration packages', () => {
    const multiDurationPackages = [
      {
        packageId: 'basic_monthly',
        name: 'Basic Monthly',
        product: {
          productId: 'basic_monthly',
          name: 'Basic Monthly',
          price: 4.99,
          priceString: '$4.99',
          currency: 'USD',
          period: 'monthly' as const,
          periodDuration: 'P1M',
        },
        entitlements: ['basic'],
      },
      {
        packageId: 'basic_yearly',
        name: 'Basic Yearly',
        product: {
          productId: 'basic_yearly',
          name: 'Basic Yearly',
          price: 39.99,
          priceString: '$39.99',
          currency: 'USD',
          period: 'yearly' as const,
          periodDuration: 'P1Y',
        },
        entitlements: ['basic'],
      },
    ];

    mockUseAllOfferings.mockReturnValue({
      offerings: mockOfferings,
      isLoading: false,
      error: null,
    });
    mockUseOfferingPackages.mockReturnValue({
      packages: multiDurationPackages,
      isLoading: false,
      error: null,
    });
    mockUseUserSubscription.mockReturnValue({
      subscription: null,
      isLoading: false,
      error: null,
    });

    render(
      <SubscriptionByOfferPage
        isLoggedIn={true}
        onNavigateToLogin={() => {}}
        userId="user-1"
      />
    );

    fireEvent.click(screen.getByTestId('segment-basic'));

    // Yearly should show savings vs monthly
    // monthly: $4.99/mo, yearly: $39.99/12 = $3.33/mo → save 33%
    expect(screen.getByText('Save 33%')).toBeTruthy();
  });
});
