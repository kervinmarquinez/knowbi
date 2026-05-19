import { Stack } from 'expo-router';

export default function AjustesLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerLargeStyle: { backgroundColor: '#F7F7FC' },
        headerStyle: { backgroundColor: 'transparent' },
        headerLargeTitle: true,
        headerBlurEffect: 'systemChromeMaterial',
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: { fontFamily: 'Nunito_700Bold' },
        headerLargeTitleStyle: { fontFamily: 'Nunito_800ExtraBold' },
        contentStyle: { backgroundColor: '#F7F7FC' },
      }}
    />
  );
}
