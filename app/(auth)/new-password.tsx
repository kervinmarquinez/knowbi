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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../lib/ui/Button';
import { updatePassword, signOut } from '../../lib/auth';

function isStrongPassword(s: string) {
  return s.length >= 8 && /[a-zA-Z]/.test(s) && /\d/.test(s);
}

export default function NewPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password === passwordConfirm;
  const canSubmit = isStrongPassword(password) && passwordsMatch && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await updatePassword(password);
    if (!result.ok) {
      setSubmitting(false);
      setError(result.error ?? 'No se pudo cambiar la contraseña');
      return;
    }
    try {
      await signOut();
    } catch {
      // ignore signOut errors; we still want to send user to login
    }
    setSubmitting(false);
    Alert.alert('Contraseña actualizada', 'Inicia sesión con tu nueva contraseña.', [
      {
        text: 'Iniciar sesión',
        onPress: () => router.replace('/(auth)/login'),
      },
    ]);
  }, [canSubmit, password, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7FC' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}
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
            <Ionicons name="lock-closed-outline" size={32} color="#534AB7" />
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
            Elige una contraseña nueva
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
            Tras guardarla, te pediremos iniciar sesión con la nueva contraseña.
          </Text>

          <Text style={styles.label}>Contraseña</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Al menos 8 caracteres"
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
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
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 12,
              color: '#888885',
              marginTop: 6,
            }}
          >
            Mínimo 8 caracteres, con al menos una letra y un número.
          </Text>

          <Text style={[styles.label, { marginTop: 16 }]}>Confirma la contraseña</Text>
          <TextInput
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="Repite la contraseña"
            secureTextEntry={!showPass}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            style={styles.input}
            placeholderTextColor="#888885"
          />

          {passwordConfirm.length > 0 && !passwordsMatch ? (
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 12,
                color: '#E24B4A',
                marginTop: 8,
              }}
            >
              Las contraseñas no coinciden.
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
              label={submitting ? 'Guardando…' : 'Cambiar contraseña'}
              onPress={onSubmit}
              disabled={!canSubmit}
            />
          </View>
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
