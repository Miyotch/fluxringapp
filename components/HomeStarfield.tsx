import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PixelRatio, StyleSheet, View } from 'react-native';
import { homeStarfieldImages, type StarfieldImages } from '../lib/homeStarfieldImages';
import { useHomeAmbientMotion } from '../lib/useHomeAmbientMotion';
import { useOrbitPreview } from '../lib/homeOrbitPreview';
import { HomeStarlight } from './HomeStarlight';
import { HomeNebulaSpace } from './HomeNebulaSpace';
import { usePausableClock } from '../lib/usePausableClock';
import { CreditsBackdrop } from './CreditsBackdrop';

/** One shared 1/f space: far stars → deforming cloud → near stars → foreground wash. */
export const HomeStarfield = React.memo(function HomeStarfield({ width, height }: {
  width: number; height: number;
}) {
  const [images, setImages] = useState<StarfieldImages | null>(null);
  const { moving, strength } = useOrbitPreview();
  const { running } = useHomeAmbientMotion(moving);
  const spaceClock = usePausableClock(running && images !== null, 50);
  const farDrift = useRef(new Animated.Value(0)).current;
  const farPosition = useRef(0);
  useEffect(() => {
    let alive = true;
    setImages(null);
    void homeStarfieldImages(width, height, Math.min(3, PixelRatio.get())).then(result => {
      if (alive) setImages(result);
    }).catch(error => console.warn('[HomeStarfield] Static image preparation failed', error));
    return () => { alive = false; };
  }, [width, height]);
  useEffect(() => {
    if (!running || !images) return;
    // Resume from the current position after backgrounding or pausing.
    let alive = true;
    const play = (value: Animated.Value, position: React.MutableRefObject<number>, duration: number) => {
      const loop = () => {
        Animated.timing(value, { toValue: 1, duration: duration * (1 - position.current),
          easing: Easing.linear, useNativeDriver: true, isInteraction: false }).start(({ finished }) => {
          if (!alive || !finished) return;
          position.current = 0;
          value.setValue(0);
          loop();
        });
      };
      loop();
    };
    play(farDrift, farPosition, width / .16 * 1000);
    return () => {
      alive = false;
      farDrift.stopAnimation(value => { farPosition.current = value; });
    };
  }, [running, images, width, farDrift]);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, height, backgroundColor: '#05040C', overflow: 'hidden' }]}>
    <CreditsBackdrop w={width} h={height} />
    {images && <>
      {/* Far stars are actually occluded by the animated transparent pigment above. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: .65, transform: [
        { translateX: farDrift.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) },
      ] }]}>
        {[-1, 0].map(tile => <Animated.Image key={tile} source={{ uri: images.starsFar }} resizeMode="stretch" fadeDuration={0}
          style={{ position: 'absolute', left: tile * width, top: 0, width, height }} />)}
      </Animated.View>
      <HomeNebulaSpace sources={images.clouds} front={false} width={width} height={height} clock={spaceClock} strength={strength} />
      <HomeStarlight stars={images.nearStars} width={width} height={height} clock={spaceClock} strength={strength} />
      <HomeNebulaSpace sources={images.clouds} front width={width} height={height} clock={spaceClock} strength={strength} />
    </>}
  </View>;
});
