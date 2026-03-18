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

import React, { useState, useEffect } from 'react';
import type { SubscriptionPeriod } from '@sudobility/types';
import {
  useAllOfferings,
  useOfferingPackages,
  useUserSubscription,
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

export interface SubscriptionByOfferPageProps {
  /** Whether the user is logged in */
  isLoggedIn: boolean;
  /** Callback when user needs to navigate to login */
  onNavigateToLogin: () => void;
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
      setPurchaseError(
        err instanceof Error ? err.message : 'Purchase failed'
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  // Build segment options: Free + each offering (localized labels)
  const segmentOptions = [
    { value: 'free', label: loc('free', 'Free') },
    ...offerings.map((o) => ({
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
          label: 'Try it for Free',
          onClick: onNavigateToLogin,
        },
      };
    }

    const hasSubscription = subscription?.isActive && subscription.packageId;

    if (!hasSubscription) {
      return {
        title: loc('free', 'Free'),
        price: '$0',
        features: freeFeatures ?? [],
        ctaButton: {
          label: 'Current Plan',
        },
        topBadge: { text: 'Current Plan', color: 'blue' },
      };
    }

    return {
      title: loc('free', 'Free'),
      price: '$0',
      features: freeFeatures ?? [],
      ctaButton: {
        label: 'Cancel Subscription',
        onClick: () => {
          if (subscription.managementUrl) {
            window.open(subscription.managementUrl, '_blank');
          }
        },
      },
    };
  };

  const getCtaLabel = (pkg: SubscriptionPackage): string => {
    if (!isLoggedIn) return 'Log in to Continue';
    const isCurrentPlan = subscription?.packageId === pkg.packageId;
    if (isCurrentPlan) return 'Current Plan';
    const hasSubscription = subscription?.isActive && subscription.packageId;
    return hasSubscription ? 'Change Subscription' : 'Subscribe';
  };

  const getCtaAction = (pkg: SubscriptionPackage, offerId: string) => {
    if (!isLoggedIn) return onNavigateToLogin;
    const isCurrentPlan = subscription?.packageId === pkg.packageId;
    if (isCurrentPlan) return undefined;
    return () => handlePurchase(pkg.packageId, offerId);
  };

  if (isLoading) {
    return (
      <SubscriptionLayout
        title={title}
        className={className}
        variant="cta"
      >
        <p>Loading subscription plans...</p>
      </SubscriptionLayout>
    );
  }

  const displayError =
    purchaseError ?? (error ? error.message : null);

  const currentStatusConfig =
    isLoggedIn && subscription?.isActive && subscription.packageId
      ? {
          isActive: true as const,
          activeContent: {
            title: 'Active Subscription',
            fields: [
              ...(subscription.productId
                ? [{ label: 'Plan', value: subscription.productId }]
                : []),
              ...(subscription.expirationDate
                ? [
                    {
                      label: 'Expires',
                      value: subscription.expirationDate.toLocaleDateString(),
                    },
                  ]
                : []),
              ...(subscription.willRenew !== undefined
                ? [
                    {
                      label: 'Auto-Renew',
                      value: subscription.willRenew ? 'Yes' : 'No',
                    },
                  ]
                : []),
            ],
          },
        }
      : undefined;

  const isFreeSelected = selectedSegment === 'free';

  return (
    <SubscriptionLayout
      title={title}
      className={className}
      variant="cta"
      error={displayError}
      currentStatus={currentStatusConfig}
      freeTileConfig={isFreeSelected ? getFreeTileConfig() : undefined}
      aboveProducts={
        segmentOptions.length > 1 ? (
          <div className="flex justify-center mb-6">
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
        <div className="col-span-full space-y-6">
          {/* Offering description area */}
          {renderOfferingContent && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-5">
              {renderOfferingContent(selectedSegment)}
            </div>
          )}

          {/* Duration options list */}
          <div className="space-y-3">
            {packages.map((pkg) => {
              const period = pkg.product?.period;
              const periodLabel = period
                ? loc(period, PERIOD_LABELS[period] ?? capitalize(period))
                : pkg.name;
              const isCurrentPlan =
                isLoggedIn &&
                subscription?.isActive &&
                subscription.packageId === pkg.packageId;
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
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-400'
                      : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700')
                  }
                >
                  {/* Left: duration title + package id + savings subtitle */}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {periodLabel}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {pkg.packageId}
                    </p>
                    {savings !== null ? (
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        Save {savings}%
                      </p>
                    ) : isCurrentPlan ? (
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        Current Plan
                      </p>
                    ) : null}
                  </div>

                  {/* Right: price CTA button or current plan label */}
                  {isCurrentPlan ? (
                    <span className="ml-4 flex-shrink-0 text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {ctaLabel}
                    </span>
                  ) : (
                    <button
                      onClick={ctaAction}
                      disabled={isPurchasing || !ctaAction}
                      className="ml-4 flex-shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {`${priceStr} · ${ctaLabel}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SubscriptionLayout>
  );
}
