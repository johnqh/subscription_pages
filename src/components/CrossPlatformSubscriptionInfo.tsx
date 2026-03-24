import type { SubscriptionPlatform, BackendSubscriptionResult } from '@sudobility/types';

const PLATFORM_NAMES: Record<string, string> = {
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
  macos: 'macOS',
};

export interface CrossPlatformSubscriptionInfoProps {
  backendSubscription: BackendSubscriptionResult;
  managementUrl?: string;
  currentPlatform: SubscriptionPlatform;
}

export function CrossPlatformSubscriptionInfo({
  backendSubscription,
  managementUrl,
}: CrossPlatformSubscriptionInfoProps) {
  const platformName = backendSubscription.platform
    ? PLATFORM_NAMES[backendSubscription.platform] ??
      backendSubscription.platform
    : 'another platform';

  return (
    <div className="col-span-full rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-6 text-center space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Subscription Active
      </h3>

      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
        <p>
          Entitlements:{' '}
          <span className="font-medium">
            {backendSubscription.entitlements.join(', ')}
          </span>
        </p>
        {backendSubscription.subscriptionStartedAt && (
          <p>
            Subscribed since:{' '}
            <span className="font-medium">
              {new Date(
                backendSubscription.subscriptionStartedAt
              ).toLocaleDateString()}
            </span>
          </p>
        )}
      </div>

      <p className="text-sm text-amber-800 dark:text-amber-300">
        Your subscription was purchased on{' '}
        <span className="font-semibold">{platformName}</span>. To manage your
        subscription, please visit your {platformName} settings.
      </p>

      {managementUrl && (
        <a
          href={managementUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Manage Subscription
        </a>
      )}
    </div>
  );
}
