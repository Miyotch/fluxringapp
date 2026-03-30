import React from 'react';
import {
  IoPersonCircleOutline,
  IoNotificationsOutline,
  IoVolumeHighOutline,
  IoColorPaletteOutline,
  IoInformationCircleOutline,
  IoLogOutOutline,
  IoChevronForward,
  IoMailOutline,
} from 'react-icons/io5';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';

const settingsGroups = [
  {
    title: 'アカウント',
    items: [
      { icon: IoPersonCircleOutline, label: 'プロフィール編集', desc: '名前・アバターの変更' },
      { icon: IoMailOutline, label: 'メールアドレス', desc: 'example@fluxring.app' },
    ],
  },
  {
    title: 'アプリ設定',
    items: [
      { icon: IoNotificationsOutline, label: '通知設定', desc: 'プッシュ通知のオン/オフ' },
      { icon: IoVolumeHighOutline, label: 'サウンド設定', desc: '音量・再生品質' },
      { icon: IoColorPaletteOutline, label: 'テーマ設定', desc: '外観のカスタマイズ' },
    ],
  },
  {
    title: 'その他',
    items: [
      { icon: IoInformationCircleOutline, label: 'アプリについて', desc: 'バージョン 1.0.0' },
      { icon: IoLogOutOutline, label: 'ログアウト', desc: '' },
    ],
  },
];

export function SettingsScreen() {
  return (
    <GradientBackground>
      <div style={pageStyle}>
        <h1 style={headingStyle}>設定</h1>
        <p style={subStyle}>サウンド設定、メールアドレス、通知設定</p>

        {/* Profile card */}
        <div style={profileCardStyle}>
          <div style={avatarStyle}>
            <IoPersonCircleOutline size={44} color={colors.primary} />
          </div>
          <div>
            <div style={profileNameStyle}>ゲストユーザー</div>
            <div style={profileEmailStyle}>ログインしていません</div>
          </div>
        </div>

        {/* Settings groups */}
        {settingsGroups.map((group) => (
          <div key={group.title} style={groupStyle}>
            <h2 style={groupTitleStyle}>{group.title}</h2>
            <div style={groupCardStyle}>
              {group.items.map((item, idx) => (
                <div key={item.label} style={{
                  ...rowStyle,
                  borderBottom: idx < group.items.length - 1 ? '1px solid rgba(200,190,220,0.2)' : 'none',
                }}>
                  <item.icon size={20} color={colors.primary} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={rowLabelStyle}>{item.label}</div>
                    {item.desc && <div style={rowDescStyle}>{item.desc}</div>}
                  </div>
                  <IoChevronForward size={16} color={colors.tabInactive} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GradientBackground>
  );
}

const pageStyle: React.CSSProperties = { padding: '32px 28px', height: '100%', overflowY: 'auto' };
const headingStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' };
const subStyle: React.CSSProperties = { fontSize: 13, color: colors.textSecondary, margin: '0 0 20px' };
const profileCardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 16, marginBottom: 24,
  background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.15), -2px -2px 6px rgba(255,255,255,0.8)',
};
const avatarStyle: React.CSSProperties = {
  width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(155,143,212,0.12)',
};
const profileNameStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: colors.textPrimary };
const profileEmailStyle: React.CSSProperties = { fontSize: 12, color: colors.textSecondary, marginTop: 2 };
const groupStyle: React.CSSProperties = { marginBottom: 20 };
const groupTitleStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: colors.textSecondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const groupCardStyle: React.CSSProperties = {
  borderRadius: 14, overflow: 'hidden',
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '2px 2px 8px rgba(174,164,204,0.12), -1px -1px 4px rgba(255,255,255,0.7)',
};
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
};
const rowLabelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: colors.textPrimary };
const rowDescStyle: React.CSSProperties = { fontSize: 11, color: colors.textSecondary, marginTop: 1 };
