import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AddTripScreen } from '../screens/AddTripScreen';
import { VisaSettingsScreen } from '../screens/VisaSettingsScreen';
import { TripsListScreen } from '../screens/TripsListScreen';
import { colors } from '../theme/colors';

export type RootStackParamList = {
  Dashboard: undefined;
  AddTrip: { 
    startDate?: string; 
    endDate?: string; 
    tripId?: string; 
    trackingMode?: 'SCHENGEN' | 'SINGLE_COUNTRY';
    targetCountry?: string;
  } | undefined;
  VisaSettings: {
    zoneId?: string;
    zoneName?: string;
    trackingMode?: 'SCHENGEN' | 'SINGLE_COUNTRY';
    targetCountry?: string;
  } | undefined;
  TripsList: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{ title: 'Schengen Tracker' }} 
      />
      <Stack.Screen 
        name="AddTrip" 
        component={AddTripScreen} 
        options={{ title: 'Add Trip', presentation: 'modal' }} 
      />
      <Stack.Screen 
        name="VisaSettings" 
        component={VisaSettingsScreen} 
        options={{ title: 'Visa Details' }} 
      />
      <Stack.Screen 
        name="TripsList" 
        component={TripsListScreen} 
        options={{ title: 'Your Trips', presentation: 'fullScreenModal' }} 
      />
    </Stack.Navigator>
  );
};
