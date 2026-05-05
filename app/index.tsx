import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useUserPlan } from '@/hooks/useUserPlan';
import { colors } from '@/theme/colors';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const { needsUsername, loading: planLoading } = useUserPlan();

  useEffect(() => {
    // no-op; gate routing below
  }, []);

  if (authLoading || (user && planLoading)) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  if (needsUsername) return <Redirect href="/setup-username" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.backgroundBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
