import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../lib/colors';
import ChallengesStack from './ChallengesStack';
import HomeScreen from '../screens/HomeScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileStack from './ProfileStack';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Challenges" component={ChallengesStack} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profile" component={ProfileStack} />
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
  const { token, isReady } = useAuth();

  if (!isReady) {
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
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
