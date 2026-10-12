import React from 'react';
import { StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AppointmentsScreen,
  DashboardScreen,
  DoctorsScreen,
  PatientsScreen,
  RecordsScreen,
} from './src/screens';
import { colors } from './src/components';

const Tab = createBottomTabNavigator();

const tabIcons = {
  Dashboard: 'grid',
  Patients: 'people',
  Doctors: 'medkit',
  Appointments: 'calendar',
  Records: 'document-text',
};

export default function MobileApp() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? tabIcons[route.name] : `${tabIcons[route.name]}-outline`}
                size={size}
                color={color}
              />
            ),
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.muted,
            tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 3 },
            tabBarStyle: {
              height: 64,
              paddingTop: 7,
              paddingBottom: 5,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            },
          })}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Patients" component={PatientsScreen} />
          <Tab.Screen name="Doctors" component={DoctorsScreen} />
          <Tab.Screen name="Appointments" component={AppointmentsScreen} />
          <Tab.Screen name="Records" component={RecordsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
