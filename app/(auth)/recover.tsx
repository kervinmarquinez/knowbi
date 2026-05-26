import { useState, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../lib/ui/Button';
import { sendOtpToEmail } from '../../lib/auth';

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function RecoverScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedConfirm = emailConfirm.trim().toLowerCase();
  const emailsMatch = normalizedEmail === normalizedConfirm;
  const canSubmit = isValidEmail(email) && isValidEmail(emailConfirm) && emailsMatch && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await sendOtpToEmail(normalizedEmail);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'No se pudo enviar el código');
      return;
    }
    router.push({
      pathname: '/(auth)/verify-code',
      params: { email: normalizedEmail },
    });
  }, [canSubmit, normalizedEmail, router]);

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
            Recuperar contraseña
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
            Te enviaremos un código a tu email para verificar que la cuenta es tuya.
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

          <Text style={[styles.label, { marginTop: 16 }]}>Confirma el email</Text>
          <TextInput
            value={emailConfirm}
            onChangeText={setEmailConfirm}
            placeholder="Repite tu email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={styles.input}
            placeholderTextColor="#888885"
          />

          {emailConfirm.length > 0 && !emailsMatch ? (
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 12,
                color: '#E24B4A',
                marginTop: 8,
              }}
            >
              Los emails no coinciden.
            </Text>
          ) : null}

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

          <View style={{ marginTop: 24 }}>
            <Button
              variant="primary"
              label={submitting ? 'Enviando…' : 'Enviar código'}
              onPress={onSubmit}
              disabled={!canSubmit}
            />
          </View>

          <Pressable
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: 16, alignItems: 'center', height: 44, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#7F77DD' }}>
              Volver a iniciar sesión
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
};
