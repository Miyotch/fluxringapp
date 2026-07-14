/**
 * AppleButton.tsx — Apple でサインイン
 * ------------------------------------------------------------------
 * expo-apple-authentication のフローを Firebase につなぐ:
 *   1. rawNonce を生成し SHA-256 でハッシュ
 *   2. AppleAuthentication.signInAsync({ nonce: hashedNonce })
 *   3. credential.identityToken と rawNonce を signInWithAppleToken へ
 *
 * iOS の対応端末（isAvailableAsync）でのみ描画される。親側で
 * APPLE_SIGNIN_ENABLED と組み合わせて表示制御する。
 */

import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import Svg, { Path } from 'react-native-svg';
import { COLOR, RADIUS } from '../constants/design-tokens';
import { signInWithAppleToken } from '../lib/firebaseAuth';

const AppleLogo: React.FC = () => (
  <Svg width={16} height={18} viewBox="0 0 16 18">
    <Path
      d="M13.2 9.5c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7C5 4.9 3.8 5.6 3.1 6.7 1.7 9 2.7 12.5 4 14.4c.6.9 1.4 1.9 2.4 1.9 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6 1.7-.9 2.3-1.8c.7-1 1-2 1-2.1 0 0-1.9-.8-2-2.9zM11.3 3.3c.5-.7.9-1.6.8-2.5-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.7-.4 2.3-1.1z"
      fill={COLOR.textPrimary}
    />
  </Svg>
);

type Props = {
  busy: boolean;
  onBusy: (b: boolean) => void;
  onError: (m: string | null) => void;
  onAuthenticated: () => void;
};

export const AppleButton: React.FC<Props> = ({ busy, onBusy, onError, onAuthenticated }) => {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then((v) => alive && setAvailable(v))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!available) return null;

  const handlePress = async () => {
    onError(null);
    try {
      // rawNonce → SHA-256（Firebase は sha256 済み nonce を要求）
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) {
        onError('Apple サインインに失敗しました（トークンなし）');
        return;
      }
      onBusy(true);
      await signInWithAppleToken(credential.identityToken, rawNonce);
      onAuthenticated();
    } catch (e: any) {
      // ユーザーが途中でキャンセルした場合はエラー表示しない
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      onError(e?.message ?? 'Apple サインインに失敗しました');
    } finally {
      onBusy(false);
    }
  };

  return (
    <Pressable style={styles.btn} onPress={handlePress} disabled={busy}>
      <AppleLogo />
      <Text style={styles.label}>Apple で続ける</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: COLOR.textPrimary, fontSize: 14, letterSpacing: 0.5 },
});

export default AppleButton;
