import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../lib/ui/Button';
import { sendOtpToEmail, verifyEmailOtp } from '../../lib/auth';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = (params.email ?? '').toLowerCase();

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const canSubmit = code.length >= 6 && !submitting && email.length > 0;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await verifyEmailOtp(email, code);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.replace('/(auth)/new-password');
  }, [canSubmit, code, email, router]);

  const onResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    const result = await sendOtpToEmail(email);
    setResending(false);
    if (!result.ok) {
      setError(result.error ?? 'No se pudo reenviar el código');
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }, [cooldown, email, resending]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7FC' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <Pressable
            onPress={() => router.back()}
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
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              backgroundColor: '#EEEDFE',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'flex-start',
              marginBottom: 18,
            }}
          >
            <Ionicons name="key-outline" size={32} color="#534AB7" />
          </View>
          <Text
            style={{
              fontFamily: 'Nunito_800ExtraBold',
              fontSize: 28,
              lineHeight: 28 * 1.2,
              letterSpacing: -0.28,
              color: '#1A1A2E',
            }}
          >
            Escribe el código
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
            Te enviamos un código a {email}. Escríbelo aquí para continuar.
          </Text>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))}
            placeholder="••••••••"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            style={styles.codeInput}
            placeholderTextColor="#C5C2BA"
          />

          {error ? (
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 13,
                color: '#E24B4A',
                marginTop: 16,
                textAlign: 'center',
              }}
            >
              {error}
            </Text>
          ) : null}

          <View style={{ marginTop: 24 }}>
            <Button
              variant="primary"
              label={submitting ? 'Verificando…' : 'Verificar código'}
              onPress={onSubmit}
              disabled={!canSubmit}
            />
          </View>

          <View style={{ marginTop: 20, alignItems: 'center' }}>
            <Pressable
              onPress={onResend}
              disabled={cooldown > 0 || resending}
              hitSlop={8}
              style={{ height: 44, justifyContent: 'center' }}
            >
              <Text
                style={{
                  fontFamily: 'DMSans_500Medium',
                  fontSize: 14,
                  color: cooldown > 0 || resending ? '#888885' : '#7F77DD',
                }}
              >
                {resending
                  ? 'Reenviando…'
                  : cooldown > 0
                    ? `Reenviar código en ${cooldown}s`
                    : 'Reenviar código'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  codeInput: {
    height: 64,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DED8',
    paddingHorizontal: 14,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 28,
    color: '#1A1A2E',
    textAlign: 'center' as const,
    letterSpacing: 8,
  } as const,
};
