import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../lib/ui/Button';
import {
  signInWithPassword,
  signInWithGoogle,
  getEffectiveCategories,
  hasValuableAnonData,
} from '../../lib/auth';

function confirmAnonOverwrite(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Vas a cambiar de cuenta',
      'Como invitado tienes racha y guardados en este móvil. Si inicias sesión, los reemplazas por los de tu cuenta.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isValidEmail(email) && password.length >= 6 && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    if (await hasValuableAnonData()) {
      const ok = await confirmAnonOverwrite();
      if (!ok) return;
    }
    setSubmitting(true);
    setError(null);
    const result = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (params.from && params.from !== 'onboarding') {
      router.replace('/(tabs)');
      return;
    }
    const cats = await getEffectiveCategories();
    router.replace(cats.length >= 3 ? '/(tabs)' : '/(onboarding)/categories?from=onboarding');
  }, [canSubmit, email, password, params.from, router]);

  const onGoogle = useCallback(async () => {
    if (await hasValuableAnonData()) {
      const ok = await confirmAnonOverwrite();
      if (!ok) return;
    }
    const result = await signInWithGoogle('login');
    if (!result.success) {
      Alert.alert('Google Sign-In', result.error);
      return;
    }
    if (params.from && params.from !== 'onboarding') {
      router.replace('/(tabs)');
      return;
    }
    const cats = await getEffectiveCategories();
    router.replace(cats.length >= 3 ? '/(tabs)' : '/(onboarding)/categories?from=onboarding');
  }, [params.from, router]);

  const onForgotPassword = useCallback(() => {
    router.push('/(auth)/recover');
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7FC' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={12}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              fontFamily: 'Nunito_800ExtraBold',
              fontSize: 28,
              lineHeight: 28 * 1.2,
              letterSpacing: -0.28,
              color: '#1A1A2E',
            }}
          >
            Bienvenido de vuelta
          </Text>
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 15,
              lineHeight: 15 * 1.55,
              color: '#444441',
              marginTop: 8,
              marginBottom: 24,
            }}
          >
            Inicia sesión para recuperar tu racha y tus píldoras guardadas.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="tu@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={styles.input}
            placeholderTextColor="#888885"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Contraseña</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              style={[styles.input, { paddingRight: 44 }]}
              placeholderTextColor="#888885"
            />
            <Pressable
              onPress={() => setShowPass((v) => !v)}
              hitSlop={8}
              style={{
                position: 'absolute',
                right: 12,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={showPass ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#888885"
              />
            </Pressable>
          </View>

          <Pressable onPress={onForgotPassword} style={{ alignSelf: 'flex-end', marginTop: 10 }}>
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#7F77DD' }}>
              ¿Olvidaste tu contraseña?
            </Text>
          </Pressable>

          {error ? (
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 13,
                color: '#E24B4A',
                marginTop: 12,
              }}
            >
              {error}
            </Text>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <Button
              variant="primary"
              label={submitting ? 'Iniciando…' : 'Iniciar sesión'}
              onPress={onSubmit}
              disabled={!canSubmit}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable onPress={onGoogle} style={styles.googleBtn}>
            <Ionicons name="logo-google" size={18} color="#1A1A2E" />
            <Text
              style={{
                fontFamily: 'DMSans_500Medium',
                fontSize: 15,
                color: '#1A1A2E',
                marginLeft: 10,
              }}
            >
              Continuar con Google
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(auth)/signup')}
            style={{ marginTop: 24, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#444441' }}>
              ¿No tienes cuenta?{' '}
              <Text style={{ color: '#7F77DD', fontFamily: 'DMSans_500Medium' }}>Crea una</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: '#444441',
    marginBottom: 6,
  } as const,
  input: {
    height: 50,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DED8',
    paddingHorizontal: 14,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: '#1A1A2E',
  } as const,
  divider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0DED8',
  },
  dividerLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#888885',
  } as const,
  googleBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0DED8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
