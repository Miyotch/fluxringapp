import React, { useState, useCallback } from 'react';
import { IoMailOutline, IoLockClosedOutline } from 'react-icons/io5';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signInWithApple,
  signInWithFacebook,
  readableAuthError,
} from '../services/auth';
import { colors } from '../theme/colors';

type Mode = 'signin' | 'signup';
type Provider = 'google' | 'apple' | 'facebook';

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | Provider | 'email'>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (busy) return;
      setError(null);
      setBusy('email');
      try {
        if (mode === 'signin') {
          await signInWithEmail(email.trim(), password);
        } else {
          await signUpWithEmail(email.trim(), password);
        }
        // App.tsx reacts to auth state change and unmounts this screen
      } catch (err) {
        setError(readableAuthError(err));
        setBusy(null);
      }
    },
    [mode, email, password, busy],
  );

  const handleProvider = useCallback(
    async (provider: Provider) => {
      if (busy) return;
      setError(null);
      setBusy(provider);
      try {
        if (provider === 'google') await signInWithGoogle();
        else if (provider === 'apple') await signInWithApple();
        else await signInWithFacebook();
      } catch (err) {
        setError(readableAuthError(err));
        setBusy(null);
      }
    },
    [busy],
  );

  return (
    <div style={pageStyle}>
      {/* Ambient aurora sweep */}
      <div className="aurora-sweep">
        <div className="aurora-band" />
        <div className="aurora-band aurora-band-b" />
      </div>
      <div
        className="aurora-orb"
        style={{
          width: 260, height: 160, top: '8%', left: '12%',
          background: 'rgba(200, 170, 255, 0.32)',
          ['--od' as any]: '22s',
        }}
      />
      <div
        className="aurora-orb"
        style={{
          width: 200, height: 140, top: '62%', left: '70%',
          background: 'rgba(180, 200, 255, 0.26)',
          ['--od' as any]: '18s', ['--odel' as any]: '-6s',
        }}
      />

      <div style={cardStyle}>
        <div style={brandStyle}>
          <div style={orbStyle} />
          <h1 style={brandTitleStyle}>Flux Ring</h1>
          <p style={brandSubStyle}>サウンドで、集中と安らぎを。</p>
        </div>

        <div style={tabRowStyle}>
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(null); }}
            style={tabStyle(mode === 'signin')}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            style={tabStyle(mode === 'signup')}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} style={formStyle}>
          <label style={fieldStyle}>
            <IoMailOutline size={16} color={colors.textSecondary} />
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <IoLockClosedOutline size={16} color={colors.textSecondary} />
            <input
              type="password"
              placeholder="パスワード（6文字以上）"
              value={password}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={inputStyle}
            />
          </label>

          {error && <div style={errorStyle}>{error}</div>}

          <button type="submit" disabled={busy !== null} style={primaryBtnStyle(busy !== null)}>
            {busy === 'email'
              ? '処理中...'
              : mode === 'signin' ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        <div style={dividerStyle}>
          <span style={dividerLineStyle} />
          <span style={dividerLabelStyle}>または</span>
          <span style={dividerLineStyle} />
        </div>

        <div style={socialRowStyle}>
          <SocialButton
            provider="google"
            busy={busy}
            onClick={() => handleProvider('google')}
          />
          <SocialButton
            provider="apple"
            busy={busy}
            onClick={() => handleProvider('apple')}
          />
          <SocialButton
            provider="facebook"
            busy={busy}
            onClick={() => handleProvider('facebook')}
          />
        </div>

        <p style={termsStyle}>
          続行することで、利用規約およびプライバシーポリシーに同意したものとみなされます。
        </p>
      </div>
    </div>
  );
}

/* ── Social button (official brand logos) ── */
const BRAND_LOGOS: Record<Provider, { src: string; label: string; size: number }> = {
  google: { src: '/brand/google.svg', label: 'Google', size: 22 },
  apple: { src: '/brand/apple.svg', label: 'Apple', size: 22 },
  facebook: { src: '/brand/facebook.svg', label: 'Facebook', size: 22 },
};

function SocialButton({
  provider,
  busy,
  onClick,
}: {
  provider: Provider;
  busy: null | Provider | 'email';
  onClick: () => void;
}) {
  const config = BRAND_LOGOS[provider];
  const isBusy = busy === provider;
  const disabled = busy !== null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...socialBtnStyle,
        opacity: disabled && !isBusy ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      aria-label={`${config.label}でログイン`}
    >
      <span style={socialIconWrapStyle}>
        <img
          src={config.src}
          alt=""
          width={config.size}
          height={config.size}
          style={{ display: 'block' }}
          draggable={false}
        />
      </span>
      <span style={socialLabelStyle}>{isBusy ? '処理中...' : config.label}</span>
    </button>
  );
}

/* ── Styles ── */
const pageStyle: React.CSSProperties = {
  position: 'relative',
  minHeight: '100vh',
  width: '100%',
  background: 'linear-gradient(180deg, #E6EBF1 0%, #dde3ed 50%, #E6EBF1 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 16px',
  overflow: 'hidden',
};

const cardStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  maxWidth: 420,
  padding: '36px 32px 28px',
  borderRadius: 24,
  background: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  border: '1px solid rgba(255, 255, 255, 0.7)',
  boxShadow:
    '10px 10px 30px rgba(174, 164, 204, 0.2), -4px -4px 16px rgba(255, 255, 255, 0.8)',
};

const brandStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: 22,
};

const orbStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%',
  margin: '0 auto 12px',
  background:
    'radial-gradient(circle at 32% 28%, #ffffff, #dac8ee 55%, #9178BD 100%)',
  boxShadow:
    '0 6px 18px rgba(145, 120, 189, 0.4), inset -2px -4px 8px rgba(140, 110, 190, 0.3), inset 2px 2px 6px rgba(255, 255, 255, 0.6)',
};

const brandTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  color: colors.textPrimary,
  letterSpacing: '0.05em',
};

const brandSubStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12,
  color: colors.textSecondary,
  fontWeight: 400,
};

const tabRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: 4,
  borderRadius: 12,
  background: 'rgba(230, 225, 240, 0.5)',
  marginBottom: 18,
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '9px 0',
  borderRadius: 9,
  border: 'none',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  color: active ? colors.textPrimary : colors.textSecondary,
  background: active ? '#ffffff' : 'transparent',
  boxShadow: active
    ? '2px 2px 6px rgba(174, 164, 204, 0.2), -1px -1px 4px rgba(255, 255, 255, 0.7)'
    : 'none',
  transition: 'background 0.2s, color 0.2s',
});

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '11px 14px',
  borderRadius: 12,
  background: 'rgba(255, 255, 255, 0.75)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow:
    'inset 1px 1px 3px rgba(174, 164, 204, 0.14), 2px 2px 6px rgba(174, 164, 204, 0.08)',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 14,
  color: colors.textPrimary,
};

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#c25a65',
  padding: '8px 12px',
  borderRadius: 8,
  background: 'rgba(220, 120, 135, 0.12)',
  border: '1px solid rgba(220, 120, 135, 0.25)',
};

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  marginTop: 4,
  padding: '12px 0',
  borderRadius: 12,
  border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled
    ? 'linear-gradient(135deg, #c2b4d6, #a899c6)'
    : 'linear-gradient(135deg, #a388c8, #9178BD)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '0.05em',
  boxShadow:
    '0 4px 12px rgba(145, 120, 189, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
  transition: 'transform 0.1s, box-shadow 0.15s',
});

const dividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  margin: '20px 0 16px',
};

const dividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  background:
    'linear-gradient(90deg, transparent, rgba(180, 170, 210, 0.5), transparent)',
};

const dividerLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: colors.textSecondary,
  fontWeight: 500,
};

const socialRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
};

const socialBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  padding: '12px 0',
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.7)',
  background: 'rgba(255, 255, 255, 0.8)',
  boxShadow:
    '2px 2px 6px rgba(174, 164, 204, 0.18), -2px -2px 5px rgba(255, 255, 255, 0.7)',
  transition: 'transform 0.1s, box-shadow 0.15s',
};

const socialIconWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
};

const socialLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: colors.textPrimary,
  letterSpacing: '0.03em',
};

const termsStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 10,
  color: colors.textSecondary,
  textAlign: 'center',
  lineHeight: 1.6,
};
