import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import mobileAds from 'react-native-google-mobile-ads';
import * as SplashScreen from 'expo-splash-screen';
import './src/i18n';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';

export default function App() {
  useEffect(() => {
    const initApp = async () => {
      try {
        // Hide splash screen immediately when root component is mounted
        await SplashScreen.hideAsync().catch(() => {});

        // Initialize Google Mobile Ads in non-personalized mode without tracking
        await mobileAds().initialize().catch((err) => console.warn('AdMob init error:', err));
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
