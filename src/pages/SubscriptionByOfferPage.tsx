/**
 * SubscriptionByOfferPage
 *
 * Subscription page that organizes packages by offering.
 * Uses a SegmentedControl to switch between offerings (with a 'Free' option).
 *
 * - Free tab: shows a free-tier tile
 * - Paid offering tabs: shows an offering description area (via callback),
 *   followed by a list of duration options with savings and price CTAs.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  SubscriptionPlatform,
  type SubscriptionPeriod,
} from '@sudobility/types';
import type { NetworkClient } from '@sudobility/types';
import { colors, ui } from '@sudobility/design';
import {
  useAllOfferings,
  useOfferingPackages,
  useUserSubscription,
  useBackendSubscription,
  getSubscriptionInstance,
  refreshSubscription,
  periodToMonths,
} from '@sudobility/subscription_lib';
import type { SubscriptionPackage } from '@sudobility/subscription_lib';
import {
  SubscriptionLayout,
  SegmentedControl,
} from '@sudobility/subscription-components';
import type { FreeTileConfig } from '@sudobility/subscription-components';
import { CrossPlatformSubscriptionInfo } from '../components/CrossPlatformSubscriptionInfo';

export interface SubscriptionByOfferPageProps {
  /** Whether the user is logged in */
  isLoggedIn: boolean;
  /** Callback when user needs to navigate to login. offerId and packageId are passed when a specific package CTA is clicked. */
  onNavigateToLogin: (offerId?: string, packageId?: string) => void;
  /** User ID for subscription lookup */
  userId?: string;
  /** User email for subscription operations */
  userEmail?: string;
  /** Features list for each package, keyed by packageId */
  featuresByPackage?: Record<string, string[]>;
  /** Features for the free tier */
  freeFeatures?: string[];
  /** Custom title for the page */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Current platform (defaults to Web) */
  currentPlatform?: SubscriptionPlatform;
  /** Network client for backend subscription fetch */
  networkClient?: NetworkClient;
  /** Backend API base URL */
  baseUrl?: string;
  /** Auth token for backend API */
  token?: string;
  /** Include sandbox purchases */
  testMode?: boolean;
  /**
   * Translation function for localizing offer names, period labels, etc.
   * Keys passed: offer identifiers (e.g. "basic", "premium"), "free",
   * period names (e.g. "monthly", "yearly").
   * Falls back to the fallback string if not provided.
   */
  t?: (key: string, fallback: string) => string;
  /**
   * Render content describing what an offering includes.
   * Called with the offering identifier (e.g. "basic", "premium").
   * Return a list of strings or React elements shown in a styled container.
   */
  renderOfferingContent?: (offerId: string) => React.ReactNode;
  /**
   * If set, automatically select the specified offering on mount.
   * Must match an offering identifier from RevenueCat.
   */
  initialOfferId?: string;
}

/** Capitalize first letter fallback */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Period display names used as fallbacks */
const PERIOD_LABELS: Record<SubscriptionPeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  lifetime: 'Lifetime',
};

/**
 * Calculate savings percentage of a package relative to a base (shortest) package.
 * Compares the monthly cost of each.
 */
function calcSavingsPercent(
  basePkg: SubscriptionPackage,
  pkg: SubscriptionPackage
): number | null {
  if (!basePkg.product || !pkg.product) return null;

  const baseMonths = periodToMonths(basePkg.product.period);
  const pkgMonths = periodToMonths(pkg.product.period);

  if (baseMonths <= 0 || pkgMonths <= 0) return null;
  if (baseMonths === Infinity || pkgMonths === Infinity) return null;
  if (baseMonths === pkgMonths) return null;

  const baseMonthlyCost = basePkg.product.price / baseMonths;
  const pkgMonthlyCost = pkg.product.price / pkgMonths;

  if (baseMonthlyCost <= 0) return null;

  const savings = Math.round(
    ((baseMonthlyCost - pkgMonthlyCost) / baseMonthlyCost) * 100
  );
  return savings > 0 ? savings : null;
}

export function SubscriptionByOfferPage({
  isLoggedIn,
  onNavigateToLogin,
  userId,
  userEmail,
  featuresByPackage: _featuresByPackage,
  freeFeatures,
  title = 'Choose Your Plan',
  className,
  currentPlatform = SubscriptionPlatform.Web,
  networkClient,
  baseUrl,
  token,
  testMode,
  t: translate,
  renderOfferingContent,
  initialOfferId,
}: SubscriptionByOfferPageProps) {
  const loc = (key: string, fallback: string) =>
    translate ? translate(key, fallback) : fallback;

  const {
    offerings,
    isLoading: isLoadingOfferings,
    error: offeringsError,
  } = useAllOfferings();

  const {
    subscription,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
  } = useUserSubscription({ userId, userEmail });

  // Backend subscription for platform detection
  const hasBackendConfig = !!(networkClient && baseUrl && token && userId);
  const backendSub = useBackendSubscription(
    networkClient ?? ({} as NetworkClient),
    baseUrl ?? '',
    token ?? '',
    userId ?? '',
    { testMode, enabled: hasBackendConfig }
  );

  const subscriptionPlatform = backendSub.data?.platform ?? null;
  const isPlatformMatch =
    !subscriptionPlatform || subscriptionPlatform === currentPlatform;

  const [selectedSegment, setSelectedSegment] = useState<string>(
    initialOfferId ?? 'free'
  );

  // Sync selectedSegment when initialOfferId changes (e.g. switching techniques)
  useEffect(() => {
    if (initialOfferId) {
      setSelectedSegment(initialOfferId);
    }
  }, [initialOfferId]);

  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Animate content when switching offerings
  const contentRef = useRef<HTMLDivElement>(null);
  const prevSegmentRef = useRef(selectedSegment);
  useEffect(() => {
    if (prevSegmentRef.current !== selectedSegment && contentRef.current) {
      contentRef.current.animate?.(
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 200, easing: 'ease-out' }
      );
      prevSegmentRef.current = selectedSegment;
    }
  }, [selectedSegment]);

  // Always call useOfferingPackages (hooks can't be conditional).
  const fallbackOfferId = offerings[0]?.offerId ?? '';
  const activeOfferId =
    selectedSegment !== 'free' ? selectedSegment : fallbackOfferId;
  const {
    packages,
    isLoading: isLoadingPackages,
    error: packagesError,
  } = useOfferingPackages(activeOfferId);

  const isLoading =
    isLoadingOfferings || isLoadingSubscription || isLoadingPackages;
  const error = offeringsError || subscriptionError || packagesError;

  const handlePurchase = async (packageId: string, offeringId: string) => {
    try {
      setIsPurchasing(true);
      setPurchaseError(null);
      const service = getSubscriptionInstance();
      await service.purchase({
        packageId,
        offeringId,
        customerEmail: userEmail,
      });
      await refreshSubscription();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  // Build segment options: Free + each offering (localized labels)
  const segmentOptions = [
    { value: 'free', label: loc('free', 'Free') },
    ...offerings.map(o => ({
      value: o.offerId,
      label: loc(o.offerId, capitalize(o.offerId)),
    })),
  ];

  // Shortest-duration package is the base for savings comparison
  const basePkg = packages[0] ?? null;

  const getFreeTileConfig = (): FreeTileConfig | undefined => {
    if (!isLoggedIn) {
      return {
        title: loc('free', 'Free'),
        price: '$0',
        features: freeFeatures ?? [],
        ctaButton: {
          label: loc('try_for_free', 'Try it for Free'),
          onClick: onNavigateToLogin,
        },
      };
    }

    const hasSubscription = subscription?.isActive && subscription.packageId;

    if (!hasSubscription) {
      // Logged in, no subscription - free is current plan, no CTA
      return {
        title: loc('free', 'Free'),
        price: '$0',
        features: freeFeatures ?? [],
        topBadge: { text: loc('current', 'Current'), color: 'blue' },
      };
    }

    // Logged in with subscription - no special free tile CTA
    return {
      title: loc('free', 'Free'),
      price: '$0',
      features: freeFeatures ?? [],
    };
  };

  const openManagementUrl = () => {
    if (subscription?.managementUrl) {
      window.open(subscription.managementUrl, '_blank');
    }
  };

  const getCtaLabel = (pkg: SubscriptionPackage): string => {
    if (!isLoggedIn) return loc('login_to_continue', 'Log in to Continue');
    const hasSubscription = subscription?.isActive && subscription.packageId;
    if (hasSubscription) {
      const isCurrentPlan =
        subscription?.packageId === pkg.packageId &&
        subscription?.offeringId === selectedSegment;
      return isCurrentPlan
        ? loc('manage_subscription', 'Manage Subscription')
        : loc('change_subscription', 'Change Subscription');
    }
    return loc('subscribe', 'Subscribe');
  };

  const getCtaAction = (pkg: SubscriptionPackage, _offerId: string) => {
    if (!isLoggedIn) return () => onNavigateToLogin(_offerId, pkg.packageId);
    const hasSubscription = subscription?.isActive && subscription.packageId;
    if (hasSubscription) {
      // All CTAs go to management URL when subscribed
      return openManagementUrl;
    }
    return () => handlePurchase(pkg.packageId, _offerId);
  };

  if (isLoading) {
    return (
      <SubscriptionLayout title={title} className={className} variant='cta'>
        <p>{loc('loading_plans', 'Loading subscription plans...')}</p>
      </SubscriptionLayout>
    );
  }

  // Cross-platform: show info instead of purchase UI
  if (!isPlatformMatch && backendSub.data) {
    return (
      <SubscriptionLayout title={title} className={className} variant='cta'>
        <CrossPlatformSubscriptionInfo
          backendSubscription={backendSub.data}
          managementUrl={subscription?.managementUrl}
          currentPlatform={currentPlatform}
        />
      </SubscriptionLayout>
    );
  }

  const displayError = purchaseError ?? (error ? error.message : null);

  const currentStatusConfig =
    isLoggedIn && subscription?.isActive && subscription.packageId
      ? {
          isActive: true as const,
          activeContent: {
            title: loc('active_subscription', 'Active Subscription'),
            fields: [
              ...(subscription.productId
                ? [
                    {
                      label: loc('plan', 'Plan'),
                      value: loc(
                        subscription.productId,
                        subscription.productId
                      ),
                    },
                  ]
                : []),
              ...(subscription.expirationDate
                ? [
                    {
                      label: loc('expires', 'Expires'),
                      value: subscription.expirationDate.toLocaleDateString(
                        undefined,
                        { dateStyle: 'long' }
                      ),
                    },
                  ]
                : []),
              ...(subscription.willRenew !== undefined
                ? [
                    {
                      label: loc('auto_renew', 'Auto-Renew'),
                      value: subscription.willRenew
                        ? loc('yes', 'Yes')
                        : loc('no', 'No'),
                    },
                  ]
                : []),
            ],
            ...(subscription.platform
              ? {
                  platform: {
                    label: loc(
                      'subscription_platform',
                      'Subscription Platform'
                    ),
                    value: subscription.platform,
                  },
                }
              : {}),
          },
        }
      : undefined;

  const isFreeSelected = selectedSegment === 'free';

  return (
    <SubscriptionLayout
      title={title}
      className={className}
      variant='cta'
      error={displayError}
      currentStatus={currentStatusConfig}
      freeTileConfig={isFreeSelected ? getFreeTileConfig() : undefined}
      aboveProducts={
        segmentOptions.length > 1 ? (
          <div className='flex justify-center mb-6'>
            <SegmentedControl
              options={segmentOptions}
              value={selectedSegment}
              onChange={setSelectedSegment}
            />
          </div>
        ) : undefined
      }
    >
      {/* Offering content + duration list for paid offerings */}
      {!isFreeSelected && (
        <div ref={contentRef} className='col-span-full space-y-6'>
          {/* Offering description area */}
          {renderOfferingContent && (
            <div
              className={`rounded-xl border p-5 ${colors.component.card.default.base} ${colors.component.card.default.dark}`}
            >
              {renderOfferingContent(selectedSegment)}
            </div>
          )}

          {/* Duration options list */}
          <div className='space-y-3'>
            {packages.map(pkg => {
              const period = pkg.product?.period;
              const periodLabel = period
                ? loc(period, PERIOD_LABELS[period] ?? capitalize(period))
                : pkg.name;
              const isCurrentPlan =
                isLoggedIn &&
                subscription?.isActive &&
                subscription.packageId === pkg.packageId &&
                subscription.offeringId === selectedSegment;
              const savings =
                basePkg && pkg.packageId !== basePkg.packageId
                  ? calcSavingsPercent(basePkg, pkg)
                  : null;
              const ctaLabel = getCtaLabel(pkg);
              const ctaAction = getCtaAction(pkg, selectedSegment);
              const priceStr = pkg.product?.priceString ?? '$0';

              return (
                <div
                  key={pkg.packageId}
                  className={
                    'flex items-center justify-between rounded-xl p-4 transition-all ' +
                    (isCurrentPlan
                      ? `border-2 ${colors.component.alert.info.base} ${colors.component.alert.info.dark}`
                      : `border ${colors.component.card.default.base} ${colors.component.card.default.dark}`)
                  }
                >
                  {/* Left: duration title + savings subtitle */}
                  <div className='min-w-0 flex-1'>
                    <p className='text-base font-semibold text-gray-900 dark:text-gray-100'>
                      {periodLabel}
                    </p>
                    {savings !== null ? (
                      <p className={`text-sm ${ui.text.success}`}>
                        {loc('save_percent', `Save ${savings}%`).replace(
                          '{{percent}}',
                          String(savings)
                        )}
                      </p>
                    ) : isCurrentPlan ? (
                      <p className={`text-sm ${ui.text.info}`}>
                        {loc('current_plan', 'Current Plan')}
                      </p>
                    ) : null}
                  </div>

                  {/* Right: price CTA button */}
                  <button
                    onClick={ctaAction}
                    disabled={isPurchasing || !ctaAction}
                    className={`ml-4 flex-shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors.component.button.primary.base} ${colors.component.button.primary.dark}`}
                  >
                    {`${priceStr} · ${ctaLabel}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SubscriptionLayout>
  );
}
