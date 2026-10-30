import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { usePlayback } from '../lib/playback';
import { useI18n } from '../lib/i18n';

export function SleepTimerButton() {
  const pb = usePlayback();
  const { lang } = useI18n();
  const en = lang === 'en';
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!pb.sleepEndsAt) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [pb.sleepEndsAt]);
  const remaining = pb.sleepEndsAt ? Math.max(0, Math.ceil((pb.sleepEndsAt - now) / 1000)) : 0;
  const title = en ? 'Sleep timer' : 'スリープタイマー';
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => setOpen(true)} style={{ padding: 12, alignSelf: 'center', minHeight: 44 }}>
      <Text style={{ color: pb.sleepEndsAt ? '#60CEE0' : '#9498BE', fontSize: 12 }}>{title}{pb.sleepEndsAt ? ` · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : ''}</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.65)', justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel={en ? 'Close' : '閉じる'} onPress={() => setOpen(false)} style={{ flex: 1 }} />
        <View style={{ backgroundColor: '#101424', padding: 24, paddingBottom: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <Text style={{ color: '#ECEEF7', fontSize: 20, marginBottom: 12 }}>{title}</Text>
          <Text style={{ color: '#9498BE', marginBottom: 12 }}>{en ? 'Let the music gently fade during the final 30 seconds, then pause.' : '終了前の30秒で音量が静かに下がり、一時停止します。'}</Text>
          {[1, 15, 30, 45, 60, 90].map(minutes => <Pressable key={minutes} accessibilityRole="button" onPress={() => { pb.setSleepTimer(minutes); setNow(Date.now()); setOpen(false); }} style={{ paddingVertical: 14 }}><Text style={{ color: '#ECEEF7', fontSize: 16 }}>{minutes} {en ? 'min' : '分'}</Text></Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => { pb.setSleepTimer(null); setOpen(false); }} style={{ paddingVertical: 14 }}><Text style={{ color: '#60CEE0' }}>{en ? 'Turn off timer' : 'タイマーを解除'}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ paddingVertical: 14 }}><Text style={{ color: '#9498BE' }}>{en ? 'Close' : '閉じる'}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}
