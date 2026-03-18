/**
 * SubscriptionByDurationPage
 *
 * Subscription page that groups packages by billing duration (monthly, yearly, etc.).
 * Uses a SegmentedControl to switch between durations.
 */

import { useState } from 'react';
import type { SubscriptionPeriod } from '@sudobility/types';
import {
  usePackagesByDuration,
  useUserSubscription,
  getSubscriptionInstance,
  refreshSubscription,
} from '@sudobility/subscription_lib';
import type { PackageWithOffer } from '@sudobility/subscription_lib';
import {
  SubscriptionLayout,
  SubscriptionTile,
  SegmentedControl,
} from '@sudobility/subscription-components';
import type { FreeTileConfig } from '@sudobility/subscription-components';

export interface SubscriptionByDurationPageProps {
  /** Whether the user is logged in */
  isLoggedIn: boolean;
  /** Callback when user needs to navigate to login */
  onNavigateToLogin: () => void;
  /** User ID for subscription lookup (undefined if not logged in) */
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
}

export function SubscriptionByDurationPage({
  isLoggedIn,
  onNavigateToLogin,
  userId,
  userEmail,
  featuresByPackage,
  freeFeatures,
  title = 'Choose Your Plan',
  className,
}: SubscriptionByDurationPageProps) {
  const {
    packagesByDuration,
    availableDurations,
    isLoading: isLoadingPackages,
    error: packagesError,
  } = usePackagesByDuration();

  const {
    subscription,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
  } = useUserSubscription({ userId, userEmail });

  const [selectedDuration, setSelectedDuration] =
    useState<SubscriptionPeriod | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Set default duration once available
  const activeDuration =
    selectedDuration ?? availableDurations[0] ?? null;

  const isLoading = isLoadingPackages || isLoadingSubscription;
  const error = packagesError || subscriptionError;

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

  const getFreeTileConfig = (): FreeTileConfig | undefined => {
    if (!isLoggedIn) {
      return {
        title: 'Free',
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
      // Logged in, no subscription - free is current plan
      return {
        title: 'Free',
        price: '$0',
        features: freeFeatures ?? [],
        ctaButton: {
          label: 'Current Plan',
        },
        topBadge: { text: 'Current Plan', color: 'blue' },
      };
    }

    // Logged in with subscription - offer to cancel
    return {
      title: 'Free',
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

  const getPaidTileCta = (pkg: PackageWithOffer) => {
    if (!isLoggedIn) {
      return {
        label: 'Log in to Continue',
        onClick: onNavigateToLogin,
      };
    }

    const hasSubscription = subscription?.isActive && subscription.packageId;
    const isCurrentPlan = subscription?.packageId === pkg.package.packageId;

    if (isCurrentPlan) {
      return undefined; // No CTA for current plan
    }

    if (!hasSubscription) {
      return {
        label: 'Subscribe',
        onClick: () => handlePurchase(pkg.package.packageId, pkg.offerId),
      };
    }

    return {
      label: 'Change Subscription',
      onClick: () => handlePurchase(pkg.package.packageId, pkg.offerId),
    };
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

  const currentPackages = activeDuration
    ? packagesByDuration[activeDuration] ?? []
    : [];

  return (
    <SubscriptionLayout
      title={title}
      className={className}
      variant="cta"
      error={displayError}
      currentStatus={currentStatusConfig}
      freeTileConfig={getFreeTileConfig()}
      aboveProducts={
        availableDurations.length > 1 ? (
          <SegmentedControl
            options={availableDurations.map((d) => ({
              value: d,
              label: d.charAt(0).toUpperCase() + d.slice(1),
            }))}
            value={activeDuration ?? availableDurations[0]}
            onChange={(value) =>
              setSelectedDuration(value as SubscriptionPeriod)
            }
          />
        ) : undefined
      }
    >
      {currentPackages.map((pkg) => {
        const isCurrentPlan =
          isLoggedIn &&
          subscription?.isActive &&
          subscription.packageId === pkg.package.packageId;
        const cta = getPaidTileCta(pkg);

        return (
          <SubscriptionTile
            key={`${pkg.offerId}-${pkg.package.packageId}`}
            id={pkg.package.packageId}
            title={pkg.package.name}
            price={pkg.package.product?.priceString ?? '$0'}
            periodLabel={
              pkg.package.product
                ? `/${pkg.package.product.period}`
                : undefined
            }
            features={
              featuresByPackage?.[pkg.package.packageId] ?? []
            }
            isSelected={false}
            onSelect={() => {}}
            isCurrentPlan={isCurrentPlan}
            ctaButton={cta}
            disabled={isPurchasing}
          />
        );
      })}
    </SubscriptionLayout>
  );
}
