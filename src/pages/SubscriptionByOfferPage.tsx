/**
 * SubscriptionByOfferPage
 *
 * Subscription page that organizes packages by offering.
 * Uses a SegmentedControl to switch between offerings (with a 'Free' option).
 */

import { useState } from 'react';
import {
  useAllOfferings,
  useOfferingPackages,
  useUserSubscription,
  getSubscriptionInstance,
  refreshSubscription,
} from '@sudobility/subscription_lib';
import type { SubscriptionPackage } from '@sudobility/subscription_lib';
import {
  SubscriptionLayout,
  SubscriptionTile,
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
}

export function SubscriptionByOfferPage({
  isLoggedIn,
  onNavigateToLogin,
  userId,
  userEmail,
  featuresByPackage,
  freeFeatures,
  title = 'Choose Your Plan',
  className,
}: SubscriptionByOfferPageProps) {
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

  const [selectedSegment, setSelectedSegment] = useState<string>('free');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Always call useOfferingPackages (hooks can't be conditional).
  // Use first offering as fallback; only consume result when selectedSegment !== 'free'.
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

  const segmentOptions = [
    { value: 'free', label: 'Free' },
    ...offerings.map((o) => ({
      value: o.offerId,
      label: o.offerId,
    })),
  ];

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

  const getPaidTileCta = (pkg: SubscriptionPackage, offerId: string) => {
    if (!isLoggedIn) {
      return {
        label: 'Log in to Continue',
        onClick: onNavigateToLogin,
      };
    }

    const hasSubscription = subscription?.isActive && subscription.packageId;
    const isCurrentPlan = subscription?.packageId === pkg.packageId;

    if (isCurrentPlan) {
      return undefined;
    }

    if (!hasSubscription) {
      return {
        label: 'Subscribe',
        onClick: () => handlePurchase(pkg.packageId, offerId),
      };
    }

    return {
      label: 'Change Subscription',
      onClick: () => handlePurchase(pkg.packageId, offerId),
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
          <SegmentedControl
            options={segmentOptions}
            value={selectedSegment}
            onChange={setSelectedSegment}
          />
        ) : undefined
      }
    >
      {!isFreeSelected &&
        packages.map((pkg) => {
          const isCurrentPlan =
            isLoggedIn &&
            subscription?.isActive &&
            subscription.packageId === pkg.packageId;
          const cta = getPaidTileCta(pkg, selectedSegment);

          return (
            <SubscriptionTile
              key={pkg.packageId}
              id={pkg.packageId}
              title={pkg.name}
              price={pkg.product?.priceString ?? '$0'}
              periodLabel={
                pkg.product ? `/${pkg.product.period}` : undefined
              }
              features={featuresByPackage?.[pkg.packageId] ?? []}
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
