import { Stack } from 'expo-router';

const isIOS = process.env.EXPO_OS === 'ios';

export default function PerfilLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: { fontFamily: 'Nunito_700Bold' },
        contentStyle: { backgroundColor: '#F7F7FC' },
        ...(isIOS
          ? {
              headerTransparent: true,
              headerLargeTitle: true,
              headerLargeTitleShadowVisible: false,
              headerLargeStyle: { backgroundColor: '#F7F7FC' },
              headerLargeTitleStyle: { fontFamily: 'Nunito_800ExtraBold' },
              headerBlurEffect: 'systemChromeMaterial',
            }
          : {
              headerStyle: { backgroundColor: '#F7F7FC' },
            }),
      }}
    />
  );
}
