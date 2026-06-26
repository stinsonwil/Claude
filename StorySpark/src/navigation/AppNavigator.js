import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import StoryScreen from '../screens/StoryScreen';
import FavoritesScreen from '../screens/FavoritesScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();

function HomeStackNavigator({ theme }) {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home">{props => <HomeScreen {...props} theme={theme} />}</HomeStack.Screen>
      <HomeStack.Screen name="Story">{props => <StoryScreen {...props} theme={theme} />}</HomeStack.Screen>
    </HomeStack.Navigator>
  );
}

export default function AppNavigator({ theme, colorScheme }) {
  return (
    <NavigationContainer theme={{ dark: colorScheme === 'dark', colors: { background: theme.background, card: theme.surface, text: theme.text, border: theme.border, primary: theme.primary, notification: theme.primary } }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border, height: 60, paddingBottom: 8 },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = { HomeTab: focused ? 'home' : 'home-outline', Favorites: focused ? 'heart' : 'heart-outline' };
            return <Ionicons name={icons[route.name]} size={22} color={color} />;
          },
        })}
      >
        <Tab.Screen name="HomeTab" options={{ title: 'Home' }}>
          {props => <HomeStackNavigator {...props} theme={theme} />}
        </Tab.Screen>
        <Tab.Screen name="Favorites" options={{ title: 'Favorites' }}>
          {props => <FavoritesScreen {...props} theme={theme} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
