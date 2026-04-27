import React, { useState } from 'react';
import { IoPersonOutline } from 'react-icons/io5';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';

export function SetupUsernameScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !user) return;
    setBusy(true);
    setError(null);
    try {
      await updateProfile(user, { displayName: trimmed });
      await updateDoc(doc(getFirestore(), 'users', user.uid), {
        displayName: trimmed,
      });
    } catch (err) {
      setError('保存に失敗しました。もう一度お試しください。');
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div className="aurora-sweep">
        <div className="aurora-band" />
        <div className="aurora-band aurora-band-b" />
      </div>

      <div style={cardStyle}>
        <div style={iconWrapStyle}>
          <IoPersonOutline size={32} color={colors.primary} />
        </div>
        <h1 style={titleStyle}>ようこそ Flux Ring へ</h1>
        <p style={subtitleStyle}>
          アプリ内で表示されるユーザー名を設定してください。
        </p>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={fieldStyle}>
            <IoPersonOutline size={16} color={colors.textSecondary} />
            <input
              type="text"
              placeholder="ユーザー名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={30}
              style={inputStyle}
              autoFocus
            />
          </label>

          {error && <div style={errorStyle}>{error}</div>}

          <button type="submit" disabled={busy || !name.trim()} style={btnStyle}>
            {busy ? '設定中...' : '設定して始める'}
          </button>
        </form>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  position: 'relative', minHeight: '100vh', width: '100%',
  background: 'linear-gradient(180deg, #E6EBF1 0%, #dde3ed 50%, #E6EBF1 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '32px 16px', overflow: 'hidden',
};
const cardStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1, width: '100%', maxWidth: 400,
  padding: '36px 32px 28px', borderRadius: 24,
  background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(22px)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '10px 10px 30px rgba(174,164,204,0.2), -4px -4px 16px rgba(255,255,255,0.8)',
  textAlign: 'center',
};
const iconWrapStyle: React.CSSProperties = {
  width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
  background: 'rgba(145,120,189,0.1)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const titleStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: '0 0 6px',
};
const subtitleStyle: React.CSSProperties = {
  fontSize: 12, color: colors.textSecondary, margin: '0 0 22px', lineHeight: 1.6,
};
const formStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12,
};
const fieldStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '11px 14px', borderRadius: 12,
  background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: 'inset 1px 1px 3px rgba(174,164,204,0.14), 2px 2px 6px rgba(174,164,204,0.08)',
};
const inputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent',
  fontSize: 14, color: colors.textPrimary,
};
const errorStyle: React.CSSProperties = {
  fontSize: 12, color: '#c25a65', padding: '8px 12px', borderRadius: 8,
  background: 'rgba(220,120,135,0.12)', border: '1px solid rgba(220,120,135,0.25)',
};
const btnStyle: React.CSSProperties = {
  padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #a388c8, #9178BD)', color: '#fff',
  fontSize: 14, fontWeight: 600, letterSpacing: '0.05em',
  boxShadow: '0 4px 12px rgba(145,120,189,0.35)',
};
