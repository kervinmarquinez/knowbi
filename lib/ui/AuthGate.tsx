import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  source?: string;
};

export function AuthGate({ icon, title, body, source }: Props) {
  const router = useRouter();
  const from = source ? `?from=${source}` : '';

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 32,
      }}
    >
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 20,
          backgroundColor: '#EEEDFE',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Ionicons name={icon} size={40} color="#534AB7" />
      </View>
      <Text
        style={{
          fontFamily: 'Nunito_800ExtraBold',
          fontSize: 22,
          lineHeight: 22 * 1.25,
          color: '#1A1A2E',
          textAlign: 'center',
          letterSpacing: -0.22,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_400Regular',
          fontSize: 15,
          lineHeight: 15 * 1.55,
          color: '#444441',
          textAlign: 'center',
          marginTop: 10,
          maxWidth: 320,
        }}
      >
        {body}
      </Text>
      <View style={{ width: '100%', maxWidth: 320, marginTop: 28, gap: 10 }}>
        <Button
          variant="primary"
          label="Crear cuenta"
          onPress={() => router.push(`/(auth)/signup${from}` as never)}
        />
        <Pressable
          onPress={() => router.push(`/(auth)/login${from}` as never)}
          style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={{
              fontFamily: 'DMSans_500Medium',
              fontSize: 14,
              color: '#7F77DD',
            }}
          >
            Ya tengo cuenta
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
