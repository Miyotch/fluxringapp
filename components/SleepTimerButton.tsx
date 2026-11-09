/**
 * SleepTimerButton.tsx — 再生パネル右下のスリープタイマー
 * ------------------------------------------------------------------
 * 目覚まし時計＋Zzz のアイコンだけを置き（動作中は水色）、押すと下からシートが出る。
 * シートでは iPhone のタイマーと同じく「時間・分・秒」の 3 列を上下にフリックして
 * 長さを決める（components/WheelPicker.tsx）。目盛りを越えるたびに軽い振動と
 * クリック音（lib/pickerFeedback.ts）。
 * 終了前の 30 秒で音量を下げて一時停止する動きは lib/playback.tsx のまま。
 */
import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { usePlayback } from '../lib/playback';
import { useI18n } from '../lib/i18n';
import { NUM_FONT } from '../constants/fonts';
import { SleepTimerIcon } from './icons';
import { WheelPicker, WHEEL_ITEM_H, WHEEL_VISIBLE } from './WheelPicker';
import {
  acquirePickerFeedback,
  pickerConfirm,
  pickerTick,
} from '../lib/pickerFeedback';

const LAST_KEY = 'fluxring.sleepTimer.lastSec';
const DEFAULT_SEC = 30 * 60;

function split(sec: number) {
  return { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
}

function clock(sec: number) {
  const { h, m, s } = split(sec);
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export function SleepTimerButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const pb = usePlayback();
  const { lang } = useI18n();
  const en = lang === 'en';
  const { width: winW } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [h, setH] = useState(0);
  const [m, setM] = useState(30);
  const [sec, setSec] = useState(0);
  const lastSec = useRef(DEFAULT_SEC);

  useEffect(() => {
    AsyncStorage.getItem(LAST_KEY)
      .then(v => { const n = Number(v); if (Number.isFinite(n) && n > 0) lastSec.current = n; })
      .catch(() => {});
  }, []);
  // 残り時間はシートを開いているときだけ毎秒数える（アイコンは色だけなので要らない）
  useEffect(() => {
    if (!pb.sleepEndsAt || !open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pb.sleepEndsAt, open]);
  useEffect(() => {
    if (!open) return;
    return acquirePickerFeedback();
  }, [open]);

  const running = !!pb.sleepEndsAt;
  const remaining = pb.sleepEndsAt ? Math.max(0, Math.ceil((pb.sleepEndsAt - now) / 1000)) : 0;
  const totalSec = h * 3600 + m * 60 + sec;
  const title = en ? 'Sleep timer' : 'スリープタイマー';

  const openSheet = () => {
    // 動いているときは残り時間、止まっているときは前回の長さから回し始める
    const t0 = Date.now();
    const rest = pb.sleepEndsAt ? Math.max(0, Math.ceil((pb.sleepEndsAt - t0) / 1000)) : 0;
    const t = split(running ? rest : lastSec.current);
    setH(t.h); setM(t.m); setSec(t.s);
    setNow(t0);
    setOpen(true);
  };
  const start = () => {
    if (totalSec <= 0) return;
    pb.setSleepTimer(totalSec / 60);
    lastSec.current = totalSec;
    AsyncStorage.setItem(LAST_KEY, String(totalSec)).catch(() => {});
    pickerConfirm('start');
    setOpen(false);
  };
  const cancelTimer = () => {
    pb.setSleepTimer(null);
    pickerConfirm('cancel');
    setOpen(false);
  };

  const colW = Math.min(110, Math.floor((Math.min(winW, 480) - 48) / 3));

  return <>
    <Pressable
      onPress={openSheet}
      hitSlop={8}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected: running }}
    >
      <SleepTimerIcon size={22} on={running} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={st.backdrop}>
        <Pressable accessibilityLabel={en ? 'Close' : '閉じる'} onPress={() => setOpen(false)} style={{ flex: 1 }} />
        <View style={st.sheet}>
          <Text style={st.title}>{title}</Text>
          <Text style={st.note}>
            {running
              ? (en ? 'Remaining ' : '残り ')
              : (en ? 'Fades out over the final 30 seconds, then pauses.' : '終了前の30秒で音量が静かに下がり、一時停止します。')}
            {running && <Text style={st.remain}>{clock(remaining)}</Text>}
          </Text>

          <View style={st.wheels}>
            <View pointerEvents="none" style={st.band} />
            <WheelPicker count={24} value={h} onChange={setH} onTick={pickerTick} width={colW} unit={en ? 'hours' : '時間'} accessibilityLabel={en ? 'Hours' : '時間'} />
            <WheelPicker count={60} value={m} onChange={setM} onTick={pickerTick} width={colW} unit={en ? 'min' : '分'} accessibilityLabel={en ? 'Minutes' : '分'} />
            <WheelPicker count={60} value={sec} onChange={setSec} onTick={pickerTick} width={colW} unit={en ? 'sec' : '秒'} accessibilityLabel={en ? 'Seconds' : '秒'} />
          </View>

          <View style={st.btnRow}>
            <Pressable
              accessibilityRole="button"
              onPress={running ? cancelTimer : () => setOpen(false)}
              style={({ pressed }) => [st.round, st.roundGhost, pressed && st.pressed]}
            >
              <Text style={st.roundGhostTxt}>{running ? (en ? 'Turn off' : '解除') : (en ? 'Cancel' : 'キャンセル')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: totalSec <= 0 }}
              disabled={totalSec <= 0}
              onPress={start}
              style={({ pressed }) => [st.round, st.roundGo, totalSec <= 0 && { opacity: 0.35 }, pressed && st.pressed]}
            >
              <Text style={st.roundGoTxt}>{running ? (en ? 'Restart' : '再設定') : (en ? 'Start' : '開始')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#101424', padding: 24, paddingBottom: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  title: { color: '#ECEEF7', fontSize: 20, marginBottom: 8 },
  note: { color: '#9498BE', marginBottom: 12 },
  remain: { color: '#60CEE0', fontFamily: NUM_FONT, fontSize: 16 },
  wheels: { flexDirection: 'row', justifyContent: 'center', height: WHEEL_ITEM_H * WHEEL_VISIBLE, marginVertical: 8 },
  band: {
    position: 'absolute', left: 0, right: 0,
    top: ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ITEM_H, height: WHEEL_ITEM_H,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 4 },
  round: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  roundGhost: { backgroundColor: 'rgba(148,152,190,0.18)', borderColor: 'rgba(148,152,190,0.35)' },
  roundGhostTxt: { color: '#ECEEF7', fontSize: 15 },
  roundGo: { backgroundColor: 'rgba(96,206,224,0.2)', borderColor: 'rgba(96,206,224,0.5)' },
  roundGoTxt: { color: '#60CEE0', fontSize: 15 },
  pressed: { transform: [{ scale: 0.95 }] },
});
