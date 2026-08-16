import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from '../config/ads';
import { colors } from '../theme/colors';

interface AdBannerProps {
  style?: object;
}

export const AdBanner: React.FC<AdBannerProps> = ({ style }) => {
  const [adFailed, setAdFailed] = useState(false);

  // If ad fails to load (offline / no inventory), collapse space to prevent UI bugs
  if (adFailed) {
    return null;
  }

  return (
    <View style={[styles.adContainer, style]}>
      <BannerAd
        unitId={AD_UNIT_IDS.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(error) => {
          console.warn('Banner Ad failed to load:', error);
          setAdFailed(true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
});
