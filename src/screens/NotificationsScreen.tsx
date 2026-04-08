import React from 'react';
import {
  IoMusicalNoteOutline,
  IoGiftOutline,
  IoMegaphoneOutline,
  IoCheckmarkCircle,
} from 'react-icons/io5';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';

const sampleNotifications = [
  {
    id: '1',
    type: 'new' as const,
    icon: IoMusicalNoteOutline,
    title: '新しいサウンドが追加されました',
    message: '「Whisper of Renewal」が利用可能になりました。',
    time: '1時間前',
    read: false,
  },
  {
    id: '2',
    type: 'promo' as const,
    icon: IoGiftOutline,
    title: 'プレミアムプラン特別オファー',
    message: '今なら初月50%オフでお試しいただけます。',
    time: '3時間前',
    read: false,
  },
  {
    id: '3',
    type: 'update' as const,
    icon: IoMegaphoneOutline,
    title: 'アプリがアップデートされました',
    message: 'v1.1.0: 新しいエフェクトとパフォーマンス改善を含みます。',
    time: '昨日',
    read: true,
  },
  {
    id: '4',
    type: 'new' as const,
    icon: IoMusicalNoteOutline,
    title: 'おすすめのサウンド',
    message: 'あなたの好みに合った新しいサウンドを見つけました。',
    time: '2日前',
    read: true,
  },
];

export function NotificationsScreen() {
  return (
    <GradientBackground>
      <div style={pageStyle}>
        <div style={headerRowStyle}>
          <div>
            <h1 style={headingStyle}>お知らせ</h1>
            <p style={subStyle}>最新のアップデートとお知らせ</p>
          </div>
          <button style={markAllStyle} type="button">
            <IoCheckmarkCircle size={14} /> すべて既読
          </button>
        </div>

        <div style={listStyle}>
          {sampleNotifications.map((n) => (
            <div key={n.id} style={{ ...notifCardStyle, opacity: n.read ? 0.7 : 1 }}>
              <div style={{ ...iconCircleStyle, background: n.read ? 'rgba(155,143,212,0.08)' : 'rgba(155,143,212,0.15)' }}>
                <n.icon size={20} color={n.read ? colors.tabInactive : colors.primary} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={notifHeaderStyle}>
                  <span style={notifTitleStyle}>{n.title}</span>
                  {!n.read && <span style={unreadDotStyle} />}
                </div>
                <p style={notifMsgStyle}>{n.message}</p>
                <span style={notifTimeStyle}>{n.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GradientBackground>
  );
}

const pageStyle: React.CSSProperties = {
  padding: '32px 28px', height: '100%', overflowY: 'auto',
  maxWidth: 900, margin: '0 auto', width: '100%',
};
const headerRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 };
const headingStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' };
const subStyle: React.CSSProperties = { fontSize: 13, color: colors.textSecondary, margin: 0 };
const markAllStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: colors.primary,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
  boxShadow: '2px 2px 6px rgba(174,164,204,0.15), -1px -1px 4px rgba(255,255,255,0.7)',
};
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };
const notifCardStyle: React.CSSProperties = {
  display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.12), -2px -2px 6px rgba(255,255,255,0.8)',
};
const iconCircleStyle: React.CSSProperties = {
  width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const notifHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };
const notifTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: colors.textPrimary };
const unreadDotStyle: React.CSSProperties = {
  width: 7, height: 7, borderRadius: '50%', background: colors.primary, flexShrink: 0,
};
const notifMsgStyle: React.CSSProperties = { fontSize: 12, color: colors.textSecondary, margin: '3px 0 4px', lineHeight: 1.5 };
const notifTimeStyle: React.CSSProperties = { fontSize: 11, color: colors.textMuted };
