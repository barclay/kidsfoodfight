import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { Colors } from '../lib/colors';
import HomeScreen from '../screens/HomeScreen';
import ChallengesScreen from '../screens/ChallengesScreen';
import LogActivityScreen from '../screens/LogActivityScreen';
import FamilyScreen from '../screens/FamilyScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Challenges: '⚔️',
    Log: '➕',
    Family: '👨‍👩‍👧‍👦',
    Profile: '👤',
  };
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>
      {icons[name]}
    </Text>
  );
}

export default function Navigation() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={route.name} focused={focused} />
          ),
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
        <Tab.Screen name="Challenges" component={ChallengesScreen} />
        <Tab.Screen
          name="Log"
          component={LogActivityScreen}
          options={{ tabBarLabel: 'Log Activity' }}
        />
        <Tab.Screen name="Family" component={FamilyScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
