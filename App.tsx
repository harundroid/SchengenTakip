import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import mobileAds from 'react-native-google-mobile-ads';
import * as SplashScreen from 'expo-splash-screen';
import { requestTrackingPermissionsAsync, getTrackingPermissionsAsync, PermissionStatus } from 'expo-tracking-transparency';
import './src/i18n';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';

export default function App() {
  useEffect(() => {
    const initApp = async () => {
      try {
        // Hide splash screen immediately when root component is mounted
        await SplashScreen.hideAsync().catch(() => {});

        if (Platform.OS === 'ios') {
          // Check current App Tracking Transparency (ATT) permission status
          const currentStatus = await getTrackingPermissionsAsync().catch(() => null);
          
          if (!currentStatus || currentStatus.status === PermissionStatus.UNDETERMINED) {
            // Small 500ms delay ensures iOS ViewController lifecycle is ready to present the native ATT modal
            setTimeout(async () => {
              try {
                await requestTrackingPermissionsAsync().catch(() => {});
              } finally {
                await mobileAds().initialize().catch((err) => console.warn('AdMob init error:', err));
              }
            }, 500);
          } else {
            await mobileAds().initialize().catch((err) => console.warn('AdMob init error:', err));
          }
        } else {
          await mobileAds().initialize().catch((err) => console.warn('AdMob init error:', err));
        }
      } catch (err) {
        console.warn('App initialization error:', err);
      }
    };

    initApp();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
