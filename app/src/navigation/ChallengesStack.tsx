import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import ChallengePostScreen from '../screens/ChallengePostScreen';
import ChallengesListScreen from '../screens/ChallengesListScreen';
import type { ChallengesStackParamList } from './types';

const Stack = createNativeStackNavigator<ChallengesStackParamList>();

export default function ChallengesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#111',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#fafafa' },
      }}
    >
      <Stack.Screen name="ChallengesList" component={ChallengesListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} options={{ title: 'Challenge' }} />
      <Stack.Screen name="ChallengePost" component={ChallengePostScreen} options={{ title: 'Submit proof' }} />
    </Stack.Navigator>
  );
}
