import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoChevronBack } from 'react-icons/io5';
import { GradientBackground } from '../../components/ui/GradientBackground';
import { colors } from '../../theme/colors';
import { useUserPlan } from '../../hooks/useUserPlan';
import { ArticlesManager } from './ArticlesManager';
import { UsersManager } from './UsersManager';
import { TracksManager } from './TracksManager';

type Tab = 'articles' | 'users' | 'tracks';

export function AdminScreen() {
  const { isAdmin, loading } = useUserPlan();
  const [tab, setTab] = useState<Tab>('tracks');
  const navigate = useNavigate();

  if (loading) return <GradientBackground><div /></GradientBackground>;
  if (!isAdmin) {
    return (
      <GradientBackground>
        <div style={pageStyle}>
          <p style={{ textAlign: 'center', color: colors.textSecondary, padding: 40 }}>
            アクセス権限がありません。
          </p>
        </div>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <div style={pageStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <button type="button" onClick={() => navigate('/settings')} style={backBtnStyle}>
            <IoChevronBack size={20} color={colors.textPrimary} />
          </button>
          <div>
            <h1 style={headingStyle}>サービス管理画面</h1>
            <p style={subStyle}>楽曲・記事・ユーザー管理</p>
          </div>
        </div>

        {/* Tab bar */}
        <div style={tabBarStyle}>
          <button type="button" onClick={() => setTab('tracks')} style={tabBtnStyle(tab === 'tracks')}>
            楽曲管理
          </button>
          <button type="button" onClick={() => setTab('articles')} style={tabBtnStyle(tab === 'articles')}>
            記事管理
          </button>
          <button type="button" onClick={() => setTab('users')} style={tabBtnStyle(tab === 'users')}>
            登録者一覧
          </button>
        </div>

        {tab === 'tracks' && <TracksManager />}
        {tab === 'articles' && <ArticlesManager />}
        {tab === 'users' && <UsersManager />}
      </div>
    </GradientBackground>
  );
}

const pageStyle: React.CSSProperties = {
  padding: '24px 28px', height: '100%', overflowY: 'auto',
  maxWidth: 960, margin: '0 auto', width: '100%',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
};
const backBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '2px 2px 6px rgba(174,164,204,0.15)',
};
const headingStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: 0,
};
const subStyle: React.CSSProperties = {
  fontSize: 12, color: colors.textSecondary, margin: '2px 0 0',
};
const tabBarStyle: React.CSSProperties = {
  display: 'flex', gap: 6, padding: 4, borderRadius: 12,
  background: 'rgba(230,225,240,0.5)', marginBottom: 20,
};
const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '9px 0', borderRadius: 9, border: 'none',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  color: active ? colors.textPrimary : colors.textSecondary,
  background: active ? '#ffffff' : 'transparent',
  boxShadow: active ? '2px 2px 6px rgba(174,164,204,0.2), -1px -1px 4px rgba(255,255,255,0.7)' : 'none',
  transition: 'background 0.2s, color 0.2s',
});
