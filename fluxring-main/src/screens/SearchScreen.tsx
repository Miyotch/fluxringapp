import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';

export function SearchScreen() {
  return (
    <GradientBackground>
      <View style={styles.container}>
        <Text style={styles.text}>検索</Text>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    color: colors.textSecondary,
  },
});
