import { Ionicons } from '@expo/vector-icons';
import { NativeTabs, Icon, Label, VectorIcon } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs tintColor="#7F77DD" labelStyle={{ fontFamily: 'DMSans_500Medium', fontSize: 10 }}>
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="home-outline" />,
            selected: <VectorIcon family={Ionicons} name="home" />,
          }}
        />
        <Label>Hoy</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="guardados">
        <Icon
          sf={{ default: 'bookmark', selected: 'bookmark.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="bookmark-outline" />,
            selected: <VectorIcon family={Ionicons} name="bookmark" />,
          }}
        />
        <Label>Guardadas</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="perfil">
        <Icon
          sf={{ default: 'person', selected: 'person.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="person-outline" />,
            selected: <VectorIcon family={Ionicons} name="person" />,
          }}
        />
        <Label>Perfil</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ajustes">
        <Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          androidSrc={{
            default: <VectorIcon family={Ionicons} name="settings-outline" />,
            selected: <VectorIcon family={Ionicons} name="settings" />,
          }}
        />
        <Label>Ajustes</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
