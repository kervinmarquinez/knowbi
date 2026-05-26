import { useRef, useState, useCallback } from 'react';
import {
  FlatList,
  View,
  Text,
  Pressable,
  useWindowDimensions,
  type ListRenderItemInfo,
  type ViewabilityConfig,
  type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../../lib/ui/Button';
import { ProgressDots } from '../../lib/ui/ProgressDots';
import { ensureAnonymousSession } from '../../lib/auth';
import { ensurePushTokenRegistered } from '../../lib/notifications';

type Slide = {
  key: string;
  illustration: 'pills' | 'streak' | 'mascot';
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: 'value',
    illustration: 'mascot',
    title: '5 cosas que no sabías, cada día.',
    body: 'Píldoras cortas de curiosidad en 3 minutos. Sin scroll infinito, sin ruido.',
  },
  {
    key: 'personalised',
    illustration: 'pills',
    title: 'Elegidas para ti.',
    body: 'Tú eliges los temas. Nosotros nos encargamos de que cada píldora valga la pena.',
  },
  {
    key: 'streak',
    illustration: 'streak',
    title: 'Construye una racha.',
    body: 'Vuelve cada día. Tu racha crece. Lo que aprendes se queda.',
  },
];

const PILLS = [
  { label: 'Ciencia', bg: '#E1F5EE', text: '#085041', x: -116, y: 18, r: -10 },
  { label: 'Historia', bg: '#F1EFE8', text: '#444441', x: 118, y: -8, r: 8 },
  { label: 'Astronomía', bg: '#EEEDFE', text: '#3C3489', x: -130, y: -78, r: -4 },
  { label: 'Arte', bg: '#FAECE7', text: '#993C1D', x: 126, y: -90, r: 12 },
  { label: 'Tecnología', bg: '#E6F1FB', text: '#0C447C', x: 0, y: 110, r: -2 },
] as const;

function FloatingPill({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: bg,
        shadowColor: '#1A1A2E',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: text }} />
      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: text }}>{label}</Text>
    </View>
  );
}

function MascotIllustration() {
  return (
    <View style={{ width: 320, height: 320 }}>
      <View
        style={{
          position: 'absolute',
          top: 20,
          left: 60,
          right: 60,
          bottom: 20,
          backgroundColor: '#EEEDFE',
          borderRadius: 200,
        }}
      />
      <Image
        source={require('../../assets/mascot-jumping.png')}
        style={{ position: 'absolute', width: 220, height: 220, left: 50, top: 50 }}
        contentFit="contain"
      />
      {PILLS.map((pill) => (
        <View
          key={pill.label}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          <View
            style={{
              transform: [
                { translateX: pill.x },
                { translateY: pill.y },
                { rotate: `${pill.r}deg` },
              ],
            }}
          >
            <FloatingPill label={pill.label} bg={pill.bg} text={pill.text} />
          </View>
        </View>
      ))}
    </View>
  );
}

function PillsStackIllustration() {
  return (
    <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }}>
      {PILLS.map((pill, i) => (
        <View
          key={pill.label}
          style={{
            position: 'absolute',
            transform: [
              { translateX: pill.x * 0.7 },
              { translateY: (i - 2) * 36 },
              { rotate: `${(i - 2) * 3}deg` },
            ],
          }}
        >
          <FloatingPill label={pill.label} bg={pill.bg} text={pill.text} />
        </View>
      ))}
    </View>
  );
}

function StreakIllustration() {
  return (
    <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: '#FAEEDA',
        }}
      />
      <Text
        style={{
          fontFamily: 'Nunito_800ExtraBold',
          fontSize: 96,
          color: '#EF9F27',
          lineHeight: 96,
        }}
      >
        7
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_500Medium',
          fontSize: 13,
          color: '#633806',
          marginTop: 8,
        }}
      >
        días seguidos
      </Text>
    </View>
  );
}

function SlideIllustration({ kind }: { kind: Slide['illustration'] }) {
  if (kind === 'mascot') return <MascotIllustration />;
  if (kind === 'pills') return <PillsStackIllustration />;
  return <StreakIllustration />;
}

function SlideView({ width, slide }: { width: number; slide: Slide }) {
  return (
    <View style={{ width, alignItems: 'center', paddingTop: 8 }}>
      <View
        style={{
          height: 340,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <SlideIllustration kind={slide.illustration} />
      </View>
      <View style={{ paddingHorizontal: 28, paddingTop: 4 }}>
        <Text
          style={{
            fontFamily: 'Nunito_800ExtraBold',
            fontSize: 26,
            lineHeight: 26 * 1.2,
            letterSpacing: -0.26,
            color: '#1A1A2E',
            textAlign: 'center',
          }}
        >
          {slide.title}
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 15,
            lineHeight: 15 * 1.55,
            color: '#444441',
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          {slide.body}
        </Text>
      </View>
    </View>
  );
}

const viewabilityConfig: ViewabilityConfig = { itemVisiblePercentThreshold: 50 };

export default function AuthWelcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [exploring, setExploring] = useState(false);

  // eslint-disable-next-line react-hooks/refs -- FlatList exige una referencia estable; useRef(fn).current la garantiza
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const getItemLayout = useCallback(
    (_: ArrayLike<Slide> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Slide>) => <SlideView width={width} slide={item} />,
    [width],
  );

  const exploreWithoutAccount = useCallback(async () => {
    if (exploring) return;
    setExploring(true);
    try {
      const session = await ensureAnonymousSession();
      ensurePushTokenRegistered(session.user.id).catch(() => {});
      const hasCategories = await AsyncStorage.getItem('user_categories');
      router.replace(hasCategories ? '/(tabs)' : '/(onboarding)/categories?from=onboarding');
    } catch (e) {
      console.error('explore anon failed', e);
      setExploring(false);
    }
  }, [exploring, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7FC' }} edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={SLIDES}
          renderItem={renderItem}
          keyExtractor={(s) => s.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
        <ProgressDots total={SLIDES.length} current={index} />
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
        <Button
          variant="primary"
          label="Crear cuenta"
          onPress={() => router.push('/(auth)/signup')}
        />
        <Button
          variant="secondary"
          label="Iniciar sesión"
          onPress={() => router.push('/(auth)/login')}
        />
        <Pressable
          onPress={exploreWithoutAccount}
          disabled={exploring}
          style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={{
              fontFamily: 'DMSans_500Medium',
              fontSize: 14,
              color: '#7F77DD',
              opacity: exploring ? 0.5 : 1,
            }}
          >
            {exploring ? 'Cargando…' : 'Explorar sin cuenta'}
          </Text>
        </Pressable>
      </View>
      <View style={{ height: 16 }} />
    </SafeAreaView>
  );
}
