import React from 'react';
import {
  IoClose,
  IoCheckmarkCircle,
  IoDiamondOutline,
  IoMusicalNotes,
} from 'react-icons/io5';
import { FaCrown } from 'react-icons/fa';
import { colors } from '../../theme/colors';

interface SubscriptionModalProps {
  onClose: () => void;
}

const PLANS = [
  {
    id: 'standard',
    name: 'スタンダード',
    price: '¥980',
    period: '/月',
    features: [
      '全楽曲のフル再生',
      'プレイリスト作成・保存',
      'オフライン再生',
      'バックグラウンド再生',
    ],
    accent: colors.primary,
    recommended: false,
  },
  {
    id: 'premium',
    name: 'プレミアム',
    price: '¥2,980',
    period: '/月',
    features: [
      'スタンダードの全機能',
      '商用利用ライセンス',
      'カスタムオーダー制作',
      '最高音質（ロスレス）',
      '優先サポート',
    ],
    accent: '#FFB33C',
    recommended: true,
  },
] as const;

export function SubscriptionModal({ onClose }: SubscriptionModalProps) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} style={closeBtnStyle} type="button">
          <IoClose size={20} color={colors.textSecondary} />
        </button>

        {/* Header */}
        <div style={headerStyle}>
          <div style={headerIconStyle}>
            <IoMusicalNotes size={28} color={colors.primary} />
          </div>
          <h2 style={headerTitleStyle}>すべての楽曲を解放</h2>
          <p style={headerSubStyle}>
            有料プランに登録すると、ロックされた楽曲を含む<br />
            全コンテンツをお楽しみいただけます。
          </p>
        </div>

        {/* Plan cards */}
        <div style={plansRowStyle}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                ...planCardStyle,
                border: plan.recommended
                  ? '2px solid rgba(255,179,60,0.5)'
                  : '1px solid rgba(255,255,255,0.7)',
              }}
            >
              {plan.recommended && (
                <div style={recommendedBadgeStyle}>
                  <FaCrown size={10} color="#fff" />
                  <span>おすすめ</span>
                </div>
              )}
              <div style={planNameStyle}>{plan.name}</div>
              <div style={planPriceRowStyle}>
                <span style={{ ...planPriceStyle, color: plan.accent }}>{plan.price}</span>
                <span style={planPeriodStyle}>{plan.period}</span>
              </div>
              <ul style={featureListStyle}>
                {plan.features.map((f) => (
                  <li key={f} style={featureItemStyle}>
                    <IoCheckmarkCircle size={14} color={plan.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                style={{
                  ...subscribeBtnStyle,
                  background: plan.recommended
                    ? 'linear-gradient(135deg, #FFD54A, #FFB33C)'
                    : `linear-gradient(135deg, #a388c8, ${colors.primary})`,
                  color: plan.recommended ? '#2a2438' : '#fff',
                }}
              >
                {plan.recommended ? (
                  <><IoDiamondOutline size={14} /> プレミアムに登録</>
                ) : (
                  '登録する'
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={footerStyle}>
          いつでもキャンセル可能です。契約期間終了まで利用できます。
        </p>
      </div>
    </div>
  );
}

/* ── Styles ── */
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 500,
  background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'searchFadeIn 0.3s ease-out',
};
const panelStyle: React.CSSProperties = {
  position: 'relative',
  width: '92%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto',
  borderRadius: 24, padding: '32px 28px 24px',
  background: 'rgba(240, 237, 248, 0.95)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '10px 10px 40px rgba(174,164,204,0.25), -4px -4px 16px rgba(255,255,255,0.8)',
};
const closeBtnStyle: React.CSSProperties = {
  position: 'absolute', top: 16, right: 16,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '50%', width: 34, height: 34, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '2px 2px 6px rgba(174,164,204,0.15)',
};
const headerStyle: React.CSSProperties = {
  textAlign: 'center', marginBottom: 24,
};
const headerIconStyle: React.CSSProperties = {
  width: 60, height: 60, borderRadius: '50%', margin: '0 auto 14px',
  background: 'rgba(145,120,189,0.12)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const headerTitleStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: '0 0 8px',
};
const headerSubStyle: React.CSSProperties = {
  fontSize: 12, color: colors.textSecondary, lineHeight: 1.7, margin: 0,
};
const plansRowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14,
  marginBottom: 18,
};
const planCardStyle: React.CSSProperties = {
  position: 'relative',
  borderRadius: 16, padding: '22px 18px 18px',
  background: 'rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.12), -2px -2px 6px rgba(255,255,255,0.7)',
  display: 'flex', flexDirection: 'column',
};
const recommendedBadgeStyle: React.CSSProperties = {
  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '4px 14px', borderRadius: 20,
  background: 'linear-gradient(135deg, #FFD54A, #FFB33C)',
  color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
  boxShadow: '0 2px 8px rgba(255,180,50,0.35)',
};
const planNameStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 6,
};
const planPriceRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 14,
};
const planPriceStyle: React.CSSProperties = {
  fontSize: 28, fontWeight: 700,
};
const planPeriodStyle: React.CSSProperties = {
  fontSize: 12, color: colors.textSecondary, fontWeight: 500,
};
const featureListStyle: React.CSSProperties = {
  listStyle: 'none', padding: 0, margin: '0 0 16px', flex: 1,
  display: 'flex', flexDirection: 'column', gap: 7,
};
const featureItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 7,
  fontSize: 12, color: colors.textPrimary, lineHeight: 1.4,
};
const subscribeBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
  boxShadow: '0 3px 10px rgba(145,120,189,0.2)',
};
const footerStyle: React.CSSProperties = {
  fontSize: 10, color: colors.textSecondary, textAlign: 'center', lineHeight: 1.6,
};
