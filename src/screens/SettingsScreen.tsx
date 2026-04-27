import React, { useState } from 'react';
import {
  IoPersonCircleOutline,
  IoNotificationsOutline,
  IoLockClosedOutline,
  IoMailOutline,
  IoInformationCircleOutline,
  IoLogOutOutline,
  IoTrashOutline,
  IoChevronForward,
  IoShieldCheckmark,
  IoWarningOutline,
  IoConstructOutline,
} from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useUserPlan } from '../hooks/useUserPlan';
import { signOut, readableAuthError, hasPasswordProvider } from '../services/auth';
import {
  updatePassword,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from 'firebase/auth';

/* ── Inline modals for password / email / delete ── */

function PasswordModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setError('新しいパスワードが一致しません。'); return; }
    if (!user?.email) { setError('メール認証でないアカウントは変更できません。'); return; }
    setBusy(true); setError(null);
    try {
      const cred = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, next);
      setDone(true);
    } catch (err) {
      setError(readableAuthError(err));
    } finally { setBusy(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={modalTitleStyle}>パスワード変更</h3>
      {done ? (
        <p style={modalSuccessStyle}>パスワードを変更しました。</p>
      ) : (
        <form onSubmit={handle} style={modalFormStyle}>
          <input type="password" placeholder="現在のパスワード" value={current} onChange={(e) => setCurrent(e.target.value)} required style={modalInputStyle} autoComplete="current-password" />
          <input type="password" placeholder="新しいパスワード（6文字以上）" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} style={modalInputStyle} autoComplete="new-password" />
          <input type="password" placeholder="新しいパスワード（確認）" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} style={modalInputStyle} autoComplete="new-password" />
          {error && <div style={modalErrStyle}>{error}</div>}
          <button type="submit" disabled={busy} style={modalPrimaryBtnStyle}>{busy ? '処理中...' : '変更する'}</button>
        </form>
      )}
    </ModalOverlay>
  );
}

function EmailModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) { setError('メール認証でないアカウントは変更できません。'); return; }
    setBusy(true); setError(null);
    try {
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);
      await updateEmail(user, newEmail.trim());
      setDone(true);
    } catch (err) {
      setError(readableAuthError(err));
    } finally { setBusy(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={modalTitleStyle}>メールアドレス変更</h3>
      <p style={modalSubStyle}>現在: {user?.email || '(未設定)'}</p>
      {done ? (
        <p style={modalSuccessStyle}>メールアドレスを変更しました。</p>
      ) : (
        <form onSubmit={handle} style={modalFormStyle}>
          <input type="password" placeholder="現在のパスワード" value={password} onChange={(e) => setPassword(e.target.value)} required style={modalInputStyle} autoComplete="current-password" />
          <input type="email" placeholder="新しいメールアドレス" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required style={modalInputStyle} autoComplete="email" />
          {error && <div style={modalErrStyle}>{error}</div>}
          <button type="submit" disabled={busy} style={modalPrimaryBtnStyle}>{busy ? '処理中...' : '変更する'}</button>
        </form>
      )}
    </ModalOverlay>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'info' | 'confirm'>('info');

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setError(null);
    try {
      if (user.email && password) {
        const cred = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, cred);
      }
      await deleteUser(user);
    } catch (err) {
      setError(readableAuthError(err));
    } finally { setBusy(false); }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h3 style={{ ...modalTitleStyle, color: '#c25a65' }}>アカウント削除</h3>
      {step === 'info' ? (
        <>
          <div style={deleteInfoStyle}>
            <IoWarningOutline size={18} color="#c25a65" />
            <p style={deleteInfoTextStyle}>
              アカウントを削除すると、保存されたプレイリスト、お気に入り、
              設定などすべてのデータが完全に削除され、復元できません。
            </p>
          </div>
          <div style={deleteInfoStyle}>
            <IoShieldCheckmark size={18} color={colors.primary} />
            <div style={deleteInfoTextStyle}>
              <strong>有料プランをご利用の場合の解約方法：</strong><br />
              アカウントを削除する前に、下記の手順でサブスクリプションを解約してください。
              <ol style={cancelStepsStyle}>
                <li><strong>iOS:</strong> 設定 → Apple ID → サブスクリプション → Flux Ring → 「サブスクリプションをキャンセル」</li>
                <li><strong>Android:</strong> Google Playストア → メニュー → 定期購入 → Flux Ring → 「定期購入を解約」</li>
                <li><strong>Webブラウザ:</strong> <a href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noopener noreferrer" style={linkStyle}>Google Play</a> または <a href="https://reportaproblem.apple.com" target="_blank" rel="noopener noreferrer" style={linkStyle}>Apple Report a Problem</a> にアクセスして解約できます。</li>
              </ol>
              サブスクリプションの解約を行わずにアカウントを削除した場合、
              課金が継続される可能性があります。必ず先に解約をお済ませください。
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep('confirm')}
            style={deleteNextBtnStyle}
          >
            理解した上で削除に進む
          </button>
        </>
      ) : (
        <form onSubmit={handleDelete} style={modalFormStyle}>
          <p style={modalSubStyle}>この操作は取り消せません。本当にアカウントを削除しますか？</p>
          {user?.email && (
            <input type="password" placeholder="パスワードを入力して確認" value={password} onChange={(e) => setPassword(e.target.value)} required style={modalInputStyle} autoComplete="current-password" />
          )}
          {error && <div style={modalErrStyle}>{error}</div>}
          <button type="submit" disabled={busy} style={deleteBtnStyle}>
            {busy ? '削除中...' : 'アカウントを完全に削除する'}
          </button>
          <button type="button" onClick={() => setStep('info')} style={cancelBtnStyle}>戻る</button>
        </form>
      )}
    </ModalOverlay>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────── */

export function SettingsScreen() {
  const { user } = useAuth();
  const { planName, isAdmin } = useUserPlan();
  const isEmailUser = hasPasswordProvider(user);
  const [modal, setModal] = useState<'password' | 'email' | 'delete' | null>(null);
  const navigate = useNavigate();

  const displayName =
    user?.displayName ||
    user?.email?.split('@')[0] ||
    (user?.isAnonymous ? 'ゲストユーザー' : 'Flux Ringユーザー');
  const displayEmail = user?.email || (user?.isAnonymous ? '匿名セッション' : '');

  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;
    try { await signOut(); } catch (err) { console.error('Logout failed', err); }
  };

  return (
    <GradientBackground>
      <div style={pageStyle}>
        <h1 style={headingStyle}>マイアカウント</h1>
        <p style={subStyle}>アカウント情報と各種設定</p>

        {/* Profile card */}
        <div style={profileCardStyle}>
          <div style={avatarStyle}>
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <IoPersonCircleOutline size={44} color={colors.primary} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={profileNameStyle}>{displayName}</div>
            <div style={profileEmailStyle}>{displayEmail}</div>
          </div>
          <div style={planBadgeStyle}>{planName}</div>
        </div>

        {/* Account */}
        <div style={groupStyle}>
          <h2 style={groupTitleStyle}>アカウント</h2>
          <div style={groupCardStyle}>
            <SettingRow icon={IoMailOutline} label="メールアドレス変更" desc={user?.email ?? ''} last={!isEmailUser} onClick={() => setModal('email')} />
            {isEmailUser && (
              <SettingRow icon={IoLockClosedOutline} label="パスワード変更" last onClick={() => setModal('password')} />
            )}
          </div>
        </div>

        {/* App Settings */}
        <div style={groupStyle}>
          <h2 style={groupTitleStyle}>アプリ設定</h2>
          <div style={groupCardStyle}>
            <SettingRow icon={IoNotificationsOutline} label="通知設定" desc="リマインダー・お知らせ通知" last />
          </div>
        </div>

        {/* Admin CMS — only visible to admins */}
        {isAdmin && (
          <div style={groupStyle}>
            <h2 style={groupTitleStyle}>運営管理</h2>
            <div style={groupCardStyle}>
              <SettingRow icon={IoConstructOutline} label="サービス管理画面" desc="記事・ユーザー管理" last onClick={() => navigate('/admin')} />
            </div>
          </div>
        )}

        {/* Info */}
        <div style={groupStyle}>
          <h2 style={groupTitleStyle}>その他</h2>
          <div style={groupCardStyle}>
            <SettingRow icon={IoInformationCircleOutline} label="アプリについて" desc="バージョン 1.0.0" last />
          </div>
        </div>

        {/* Logout */}
        <div style={groupStyle}>
          <div style={groupCardStyle}>
            <button type="button" onClick={handleLogout} style={logoutBtnStyle}>
              <IoLogOutOutline size={20} color="#c25a65" />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ ...rowLabelStyle, color: '#c25a65' }}>ログアウト</div>
              </div>
              <IoChevronForward size={16} color={colors.tabInactive} />
            </button>
          </div>
        </div>

        {/* Account delete */}
        <div style={groupStyle}>
          <div style={groupCardStyle}>
            <button type="button" onClick={() => setModal('delete')} style={logoutBtnStyle}>
              <IoTrashOutline size={20} color="#999" />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ ...rowLabelStyle, color: '#999' }}>アカウントを削除</div>
                <div style={rowDescStyle}>すべてのデータが完全に削除されます</div>
              </div>
              <IoChevronForward size={16} color={colors.tabInactive} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'password' && <PasswordModal onClose={() => setModal(null)} />}
      {modal === 'email' && <EmailModal onClose={() => setModal(null)} />}
      {modal === 'delete' && <DeleteAccountModal onClose={() => setModal(null)} />}
    </GradientBackground>
  );
}

function SettingRow({ icon: Icon, label, desc, last, onClick }: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  desc?: string;
  last?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      style={{ ...rowStyle, borderBottom: last ? 'none' : '1px solid rgba(200,190,220,0.2)', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <Icon size={20} color={colors.primary} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowLabelStyle}>{label}</div>
        {desc && <div style={rowDescStyle}>{desc}</div>}
      </div>
      <IoChevronForward size={16} color={colors.tabInactive} />
    </div>
  );
}

/* ── Styles ── */

const pageStyle: React.CSSProperties = { padding: '32px 28px', height: '100%', overflowY: 'auto', maxWidth: 900, margin: '0 auto', width: '100%' };
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
const planBadgeStyle: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0,
  background: 'linear-gradient(135deg, rgba(145,120,189,0.12), rgba(180,140,220,0.15))',
  color: colors.primary, border: '1px solid rgba(145,120,189,0.2)',
};

const groupStyle: React.CSSProperties = { marginBottom: 20 };
const groupTitleStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: colors.textSecondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const groupCardStyle: React.CSSProperties = {
  borderRadius: 14, overflow: 'hidden',
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '2px 2px 8px rgba(174,164,204,0.12), -1px -1px 4px rgba(255,255,255,0.7)',
};
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' };
const rowLabelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: colors.textPrimary };
const rowDescStyle: React.CSSProperties = { fontSize: 11, color: colors.textSecondary, marginTop: 1 };
const logoutBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer',
  width: '100%', background: 'transparent', border: 'none',
};

/* ── Modal styles ── */
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 500,
  background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'searchFadeIn 0.25s ease-out',
};
const modalCardStyle: React.CSSProperties = {
  width: '90%', maxWidth: 440, borderRadius: 20, padding: '28px 26px',
  background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: '10px 10px 30px rgba(174,164,204,0.2), -4px -4px 16px rgba(255,255,255,0.8)',
};
const modalTitleStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: colors.textPrimary, margin: '0 0 12px' };
const modalSubStyle: React.CSSProperties = { fontSize: 12, color: colors.textSecondary, margin: '0 0 14px', lineHeight: 1.6 };
const modalFormStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };
const modalInputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(200,190,220,0.3)',
  background: 'rgba(255,255,255,0.7)', fontSize: 13, color: colors.textPrimary, outline: 'none',
};
const modalErrStyle: React.CSSProperties = {
  fontSize: 12, color: '#c25a65', padding: '8px 12px', borderRadius: 8,
  background: 'rgba(220,120,135,0.12)', border: '1px solid rgba(220,120,135,0.25)',
};
const modalSuccessStyle: React.CSSProperties = {
  fontSize: 13, color: '#5a9e6e', padding: '12px 14px', borderRadius: 8,
  background: 'rgba(90,180,120,0.1)', border: '1px solid rgba(90,180,120,0.2)',
};
const modalPrimaryBtnStyle: React.CSSProperties = {
  marginTop: 4, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #a388c8, #9178BD)', color: '#fff',
  fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
  boxShadow: '0 3px 10px rgba(145,120,189,0.3)',
};
const deleteInfoStyle: React.CSSProperties = {
  display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10, marginBottom: 14,
  background: 'rgba(240,235,248,0.5)', border: '1px solid rgba(200,190,220,0.25)',
  alignItems: 'flex-start',
};
const deleteInfoTextStyle: React.CSSProperties = { fontSize: 12, color: colors.textPrimary, lineHeight: 1.7 };
const cancelStepsStyle: React.CSSProperties = { margin: '8px 0 8px 18px', fontSize: 11, color: colors.textSecondary, lineHeight: 1.7 };
const linkStyle: React.CSSProperties = { color: colors.primary, textDecoration: 'underline' };
const deleteNextBtnStyle: React.CSSProperties = {
  padding: '11px 0', borderRadius: 10, border: '1px solid rgba(194,90,101,0.3)', cursor: 'pointer',
  background: 'rgba(194,90,101,0.08)', color: '#c25a65',
  fontSize: 13, fontWeight: 600, width: '100%',
};
const deleteBtnStyle: React.CSSProperties = {
  marginTop: 4, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #d85a65, #c25a65)', color: '#fff',
  fontSize: 13, fontWeight: 600,
  boxShadow: '0 3px 10px rgba(194,90,101,0.3)',
};
const cancelBtnStyle: React.CSSProperties = {
  padding: '9px 0', borderRadius: 10, border: '1px solid rgba(200,190,220,0.3)', cursor: 'pointer',
  background: 'transparent', color: colors.textSecondary, fontSize: 12, fontWeight: 500,
};
