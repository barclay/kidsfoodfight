import './src/i18n/config';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { UploadToastProvider } from './src/context/UploadToastContext';
import Navigation from './src/navigation';

/** Jest has no native safe-area host; without metrics the tree never mounts past RNCSafeAreaProvider. */
const testSafeAreaMetrics: Metrics | undefined =
  process.env.NODE_ENV === 'test'
    ? {
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }
    : undefined;

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={testSafeAreaMetrics}>
        <AuthProvider>
          <LanguageProvider>
            <UploadToastProvider>
              <Navigation />
            </UploadToastProvider>
          </LanguageProvider>
        </AuthProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </View>
  );
}
