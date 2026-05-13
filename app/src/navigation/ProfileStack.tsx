import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../lib/colors';
import ProfileHomeScreen from '../screens/ProfileHomeScreen';
import ProfilePhotoCropScreen from '../screens/ProfilePhotoCropScreen';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#111',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ProfilePhotoCrop"
        component={ProfilePhotoCropScreen}
        options={{ title: 'Crop photo', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}
      />
    </Stack.Navigator>
  );
}
