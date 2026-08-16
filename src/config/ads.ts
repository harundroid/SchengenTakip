import { TestIds, InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

declare const process: any;

/**
 * Centralized AdMob Configuration with automatic __DEV__ guard to prevent accidental clicks
 * and account bans during testing.
 */
export const AD_UNIT_IDS = {
  BANNER: Platform.select({
    ios: __DEV__ ? TestIds.BANNER : (process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || TestIds.BANNER),
    android: __DEV__ ? TestIds.BANNER : (process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || TestIds.BANNER),
    default: TestIds.BANNER,
  })!,
  INTERSTITIAL: Platform.select({
    ios: __DEV__ ? TestIds.INTERSTITIAL : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS || TestIds.INTERSTITIAL),
    android: __DEV__ ? TestIds.INTERSTITIAL : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID || TestIds.INTERSTITIAL),
    default: TestIds.INTERSTITIAL,
  })!,
};

/**
 * Helper to show an Interstitial Ad safely after a completed user flow
 * (e.g. after adding/saving a trip, NOT during data entry).
 */
export const showCompletedFlowInterstitial = () => {
  try {
    const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.INTERSTITIAL, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitial.show().catch(err => console.warn('Could not show interstitial:', err));
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      unsubscribeLoaded();
      unsubscribeClosed();
    });

    const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('Interstitial Ad Error:', error);
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
    });

    interstitial.load();
  } catch (e) {
    console.warn('Failed to initialize interstitial ad:', e);
  }
};
