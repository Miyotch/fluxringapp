import React, { useState } from 'react';
import { IoClose, IoCheckmarkCircle } from 'react-icons/io5';
import type { Track } from '../../types/track';

interface ExtensionPlanModalProps {
  track: Track;
  onClose: () => void;
  onBack?: () => void;
}

const PLANS = [
  { id: '10', label: '10分', desc: 'ちょっとした休憩に', price: '¥300', badge: null },
  { id: '30', label: '30分', desc: '集中したいときに最適', price: '¥600', badge: null },
  { id: '60', label: '60分', desc: '作業BGMとして', price: '¥800', badge: 'おすすめ' },
  { id: '120', label: '120分', desc: '長い集中時間入へ', price: '¥1,200', badge: null },
];

export function ExtensionPlanModal({ track, onClose }: ExtensionPlanModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  const selectedPlan = PLANS.find((p) => p.id === selected);

  if (purchased && selectedPlan) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={completedModalStyle} onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} style={closeBtnTopStyle} type="button">
            <IoClose size={18} color="#999" />
          </button>
          <div style={completedContentStyle}>
            <div style={checkCircleStyle}>
              <IoCheckmarkCircle size={48} color="#9178BD" />
            </div>
            <h3 style={completedTitleStyle}>購入完了！</h3>
            <p style={completedDescStyle}>
              「{track.title}({selectedPlan.label})」を{'\n'}あなたのプレイリストに追加しました。
            </p>
            <div style={completedTrackStyle}>
              {track.artworkUrl && (
                <img src={track.artworkUrl} alt="" style={completedArtStyle} />
              )}
              <div>
                <div style={completedTrackNameStyle}>{track.title} · {selectedPlan.label}ver.</div>
                <div style={completedTrackSubStyle}>購入済み</div>
              </div>
            </div>
            <button onClick={onClose} style={closeFinalBtnStyle} type="button">
              閉じる
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h2 style={headerTitleStyle}>延長プランを選択 ⓘ</h2>
            <p style={headerSubStyle}>「{track.title}」をライブラリに追加します。</p>
          </div>
          <button onClick={onClose} style={closeBtnStyle} type="button">
            <IoClose size={20} color="#999" />
          </button>
        </div>

        <div style={planListStyle}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                ...planCardStyle,
                border: selected === plan.id
                  ? '2px solid #9178BD'
                  : '1px solid rgba(255,255,255,0.12)',
                background: selected === plan.id
                  ? 'rgba(145,120,189,0.1)'
                  : 'rgba(255,255,255,0.04)',
              }}
              onClick={() => setSelected(plan.id)}
            >
              <div style={radioStyle}>
                <div style={{
                  ...radioDotStyle,
                  background: selected === plan.id ? '#9178BD' : 'transparent',
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={planLabelRowStyle}>
                  <span style={planLabelStyle}>{plan.label}</span>
                  {plan.badge && <span style={planBadgeStyle}>{plan.badge}</span>}
                </div>
                <div style={planDescStyle}>{plan.desc}</div>
              </div>
              <div style={planPriceStyle}>{plan.price}</div>
            </div>
          ))}
        </div>

        <p style={noteStyle}>
          ※購入後の楽曲はあなたのプレイリストに保存されます。{'\n'}
          ※アプリ内課金が発生します。
        </p>

        <button
          style={{
            ...purchaseBtnStyle,
            opacity: selected ? 1 : 0.4,
            cursor: selected ? 'pointer' : 'default',
          }}
          onClick={() => selected && setPurchased(true)}
          disabled={!selected}
          type="button"
        >
          {selected
            ? `${selectedPlan?.price}で購入・追加`
            : 'プランを選択してください'}
        </button>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modalStyle: React.CSSProperties = {
  background: '#1c1c2e', borderRadius: 20, padding: '28px 24px 24px',
  maxWidth: 440, width: '90%', color: '#fff',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20,
};
const headerTitleStyle: React.CSSProperties = { fontSize: 17, fontWeight: 700, margin: '0 0 4px' };
const headerSubStyle: React.CSSProperties = { fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 };
const closeBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 4 };
const planListStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 };
const planCardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
  borderRadius: 14, cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
};
const radioStyle: React.CSSProperties = {
  width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const radioDotStyle: React.CSSProperties = {
  width: 10, height: 10, borderRadius: '50%', transition: 'background 0.15s',
};
const planLabelRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const planLabelStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600 };
const planBadgeStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
  background: '#9178BD', color: '#fff',
};
const planDescStyle: React.CSSProperties = { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 };
const planPriceStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, flexShrink: 0 };
const noteStyle: React.CSSProperties = {
  fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-line',
};
const purchaseBtnStyle: React.CSSProperties = {
  width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg, #9178BD, #6c5ce7)', color: '#fff',
  fontSize: 14, fontWeight: 600, transition: 'opacity 0.2s',
};

// --- Purchase complete ---
const completedModalStyle: React.CSSProperties = {
  background: '#1c1c2e', borderRadius: 20, padding: '24px',
  maxWidth: 360, width: '85%', color: '#fff', position: 'relative',
};
const closeBtnTopStyle: React.CSSProperties = {
  position: 'absolute', top: 16, right: 16,
  background: 'none', border: 'none', cursor: 'pointer',
};
const completedContentStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
  padding: '8px 0',
};
const checkCircleStyle: React.CSSProperties = { marginBottom: 12 };
const completedTitleStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, margin: '0 0 8px' };
const completedDescStyle: React.CSSProperties = {
  fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 20px', whiteSpace: 'pre-line',
};
const completedTrackStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '10px 14px',
  marginBottom: 20, width: '100%',
};
const completedArtStyle: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 8, objectFit: 'cover',
};
const completedTrackNameStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, textAlign: 'left' };
const completedTrackSubStyle: React.CSSProperties = { fontSize: 11, color: '#9178BD', textAlign: 'left', marginTop: 2 };
const closeFinalBtnStyle: React.CSSProperties = {
  width: '100%', padding: '11px 0', borderRadius: 10,
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
  color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
