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
    // Hide splash screen immediately when app mounts
    SplashScreen.hideAsync().catch(() => {});
    mobileAds().initialize().catch(err => console.warn('AdMob error', err));
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
