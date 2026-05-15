import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Colors } from '../lib/colors';
import ChallengesStack from './ChallengesStack';
import type { RootStackParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileStack from './ProfileStack';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Challenges: '⚔️',
    Leaderboard: '🏆',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>
      {icons[name]}
    </Text>
  );
}

function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: Colors.orange,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 6,
          borderTopColor: Colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tabs.home') }} />
      <Tab.Screen
        name="Challenges"
        component={ChallengesStack}
        options={{ tabBarLabel: t('tabs.challenges') }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ tabBarLabel: t('tabs.leaderboard') }}
      />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ tabBarLabel: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}

function BootSplash() {
  return (
    <View style={bootStyles.root}>
      <ActivityIndicator size="large" color={Colors.orange} />
    </View>
  );
}

const bootStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});

export default function Navigation() {
  const { t } = useTranslation();
  const { token, isReady: authReady } = useAuth();
  const { isReady: languageReady } = useLanguage();

  if (!authReady || !languageReady) {
    return <BootSplash />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        key={token ? 'authed' : 'anon'}
        screenOptions={{ headerShown: false }}
      >
        {token ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Group>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen
              name="Signup"
              component={SignupScreen}
              options={{
                headerShown: true,
                title: t('navigation.createAccount'),
                headerStyle: { backgroundColor: Colors.surface },
                headerTintColor: Colors.orange,
                headerTitleStyle: { fontWeight: '700' },
                headerShadowVisible: false,
              }}
            />
          </RootStack.Group>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
