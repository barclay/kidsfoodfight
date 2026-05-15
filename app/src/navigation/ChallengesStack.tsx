import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import ChallengePhotoEditorScreen from '../screens/ChallengePhotoEditorScreen';
import ChallengePostScreen from '../screens/ChallengePostScreen';
import ChallengesListScreen from '../screens/ChallengesListScreen';
import type { ChallengesStackParamList } from './types';

const Stack = createNativeStackNavigator<ChallengesStackParamList>();

export default function ChallengesStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#111',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#fafafa' },
      }}
    >
      <Stack.Screen name="ChallengesList" component={ChallengesListScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ChallengeDetail"
        component={ChallengeDetailScreen}
        options={{ title: t('navigation.challenge') }}
      />
      <Stack.Screen
        name="ChallengePost"
        component={ChallengePostScreen}
        options={{ title: t('navigation.submitProof') }}
      />
      <Stack.Screen
        name="ChallengePhotoEditor"
        component={ChallengePhotoEditorScreen}
        options={{ title: t('navigation.stickers') }}
      />
    </Stack.Navigator>
  );
}
