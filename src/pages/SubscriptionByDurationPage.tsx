/**
 * SubscriptionByDurationPage
 *
 * Subscription page that groups packages by billing duration (monthly, yearly, etc.).
 * Uses a SegmentedControl to switch between durations.
 */

import { useState } from 'react';
import {
  SubscriptionPlatform,
  type SubscriptionPeriod,
} from '@sudobility/types';
import type { NetworkClient } from '@sudobility/types';
import {
  usePackagesByDuration,
  useUserSubscription,
  useBackendSubscription,
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
import { CrossPlatformSubscriptionInfo } from '../components/CrossPlatformSubscriptionInfo';

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
   * Translation function for localizing labels.
   * Falls back to the fallback string if not provided.
   */
  t?: (key: string, fallback: string) => string;
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
  currentPlatform = SubscriptionPlatform.Web,
  networkClient,
  baseUrl,
  token,
  testMode,
  t: translate,
}: SubscriptionByDurationPageProps) {
  const loc = (key: string, fallback: string) =>
    translate ? translate(key, fallback) : fallback;
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

  const [selectedDuration, setSelectedDuration] =
    useState<SubscriptionPeriod | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Set default duration once available
  const activeDuration = selectedDuration ?? availableDurations[0] ?? null;

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
      setPurchaseError(err instanceof Error ? err.message : 'Purchase failed');
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
      // Logged in, no subscription - free is current plan, no CTA
      return {
        title: 'Free',
        price: '$0',
        features: freeFeatures ?? [],
        topBadge: { text: 'Current', color: 'blue' },
      };
    }

    // Logged in with subscription - offer to manage
    return {
      title: 'Free',
      price: '$0',
      features: freeFeatures ?? [],
    };
  };

  const openManagementUrl = () => {
    if (subscription?.managementUrl) {
      window.open(subscription.managementUrl, '_blank');
    }
  };

  const getPaidTileCta = (pkg: PackageWithOffer) => {
    if (!isLoggedIn) {
      return {
        label: 'Log in to Continue',
        onClick: onNavigateToLogin,
      };
    }

    const hasSubscription = subscription?.isActive && subscription.packageId;
    const isCurrentPlan =
      subscription?.packageId === pkg.package.packageId &&
      subscription?.offeringId === pkg.offerId;

    if (hasSubscription) {
      // All CTAs go to management URL when subscribed
      return {
        label: isCurrentPlan ? 'Manage Subscription' : 'Change Subscription',
        onClick: openManagementUrl,
      };
    }

    return {
      label: 'Subscribe',
      onClick: () => handlePurchase(pkg.package.packageId, pkg.offerId),
    };
  };

  if (isLoading) {
    return (
      <SubscriptionLayout title={title} className={className} variant='cta'>
        <p>Loading subscription plans...</p>
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

  const currentPackages = activeDuration
    ? (packagesByDuration[activeDuration] ?? [])
    : [];

  return (
    <SubscriptionLayout
      title={title}
      className={className}
      variant='cta'
      error={displayError}
      currentStatus={currentStatusConfig}
      freeTileConfig={getFreeTileConfig()}
      aboveProducts={
        availableDurations.length > 1 ? (
          <div className="flex justify-center mb-6">
            <SegmentedControl
              options={availableDurations.map(d => ({
                value: d,
                label: d.charAt(0).toUpperCase() + d.slice(1),
              }))}
              value={activeDuration ?? availableDurations[0]}
              onChange={value => setSelectedDuration(value as SubscriptionPeriod)}
            />
          </div>
        ) : undefined
      }
    >
      {currentPackages.map(pkg => {
        const isCurrentPlan =
          isLoggedIn &&
          subscription?.isActive &&
          subscription.packageId === pkg.package.packageId &&
          subscription.offeringId === pkg.offerId;
        const cta = getPaidTileCta(pkg);

        return (
          <SubscriptionTile
            key={`${pkg.offerId}-${pkg.package.packageId}`}
            id={pkg.package.packageId}
            title={pkg.package.name}
            price={pkg.package.product?.priceString ?? '$0'}
            periodLabel={
              pkg.package.product ? `/${pkg.package.product.period}` : undefined
            }
            features={featuresByPackage?.[pkg.package.packageId] ?? []}
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
