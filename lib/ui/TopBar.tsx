import { View } from 'react-native';
import { Image } from 'expo-image';
import { StreakPill } from './StreakPill';
import { LogoWordmark } from './LogoWordmark';

export function TopBar({ streak }: { streak?: number }) {
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Image
          source={require('../../assets/mascot-head.png')}
          style={{ width: 32, height: 32, borderRadius: 10 }}
          contentFit="cover"
        />
        <LogoWordmark height={30} />
      </View>
      {typeof streak === 'number' && <StreakPill count={streak} />}
    </View>
  );
}
