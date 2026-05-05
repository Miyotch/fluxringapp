import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { FloatingCapsuleTabBar } from '@/components/navigation/FloatingCapsuleTabBar';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingCapsuleTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'ホーム' }} />
      <Tabs.Screen name="search" options={{ title: '検索' }} />
      <Tabs.Screen name="playlist" options={{ title: 'プレイリスト' }} />
      <Tabs.Screen name="articles" options={{ title: '記事を読む' }} />
      <Tabs.Screen name="notifications" options={{ title: 'お知らせ' }} />
      <Tabs.Screen name="settings" options={{ title: '設定' }} />
    </Tabs>
  );
}
