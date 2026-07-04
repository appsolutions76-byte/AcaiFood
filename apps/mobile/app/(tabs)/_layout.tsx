import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#5b21b6', // Default brand color, can be dynamic later using a Context
        headerShown: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Cliente',
        }}
      />
      <Tabs.Screen
        name="loja"
        options={{
          title: 'Minha Loja',
        }}
      />
      <Tabs.Screen
        name="produtos"
        options={{
          title: 'Produtos',
        }}
      />
    </Tabs>
  );
}
