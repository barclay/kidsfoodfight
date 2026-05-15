import './src/i18n/config';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { UploadToastProvider } from './src/context/UploadToastContext';
import Navigation from './src/navigation';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <UploadToastProvider>
              <Navigation />
            </UploadToastProvider>
          </AuthProvider>
        </LanguageProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </View>
  );
}
