import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';

interface GradientBackgroundProps {
  children?: ReactNode;
}

export function GradientBackground({ children }: GradientBackgroundProps) {
  return (
    <View style={styles.root}>
      <LinearGradient
        // Spec: linear-gradient(180deg, #E6EBF1 0%, #dde3ed 50%, #E6EBF1 100%)
        // — light → mid → light, top to bottom.
        colors={['#E6EBF1', '#dde3ed', '#E6EBF1']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.backgroundBase,
  },
});
