import React, { useState } from 'react';
import { IoClose, IoCheckmark } from 'react-icons/io5';
import type { Track } from '../../types/track';
import { ExtensionPlanModal } from './ExtensionPlanModal';

interface CustomOrderModalProps {
  track: Track;
  onClose: () => void;
}

export function CustomOrderModal({ track, onClose }: CustomOrderModalProps) {
  const [showExtension, setShowExtension] = useState(false);

  if (showExtension) {
    return (
      <ExtensionPlanModal
        track={track}
        onClose={onClose}
        onBack={() => setShowExtension(false)}
      />
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={headerTitleStyle}>★ カスタム制作メニュー ⓘ</span>
          <button onClick={onClose} style={closeBtnStyle} type="button">
            <IoClose size={20} color="#999" />
          </button>
        </div>

        <div style={cardsRowStyle}>
          {/* Semi order */}
          <div style={cardStyle}>
            <div style={badgeRowStyle}>
              <span style={badgeStyle}>Semi order</span>
              <span style={badgeSubStyle}>アプリ内で完結</span>
            </div>
            <h3 style={cardTitleStyle}>時間を延長する</h3>
            <p style={cardDescStyle}>
              現在の曲「{track.title}」をご希望の長さに延長し、あなたのプレイリストに追加します。
            </p>
            <div style={checkListStyle}>
              <div style={checkItemStyle}><IoCheckmark size={14} color="#9178BD" /> 10分〜120分まで選択可能</div>
              <div style={checkItemStyle}><IoCheckmark size={14} color="#9178BD" /> 300円〜の都度課金</div>
            </div>
            <button
              onClick={() => setShowExtension(true)}
              style={primaryBtnStyle}
              type="button"
            >
              長さを選んで延長する
            </button>
          </div>

          {/* Full order */}
          <div style={cardStyle}>
            <div style={badgeRowStyle}>
              <span style={{ ...badgeStyle, background: '#9178BD' }}>Full order</span>
              <span style={badgeSubStyle}>webブラウザへ遷移</span>
            </div>
            <h3 style={cardTitleStyle}>オリジナルBGM制作</h3>
            <p style={cardDescStyle}>
              ホテル、サロン、企業のブランディング用に、世界に一つのオリジナル楽曲を制作します。
            </p>
            <div style={checkListStyle}>
              <div style={checkItemStyle}><IoCheckmark size={14} color="#9178BD" /> プロの作曲家による制作</div>
              <div style={checkItemStyle}><IoCheckmark size={14} color="#9178BD" /> 商用利用可能</div>
            </div>
            <button style={outlineBtnStyle} type="button">
              詳しくはこちら →
            </button>
          </div>
        </div>
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
  background: '#1c1c2e', borderRadius: 20, padding: '28px 28px 24px',
  maxWidth: 620, width: '90%', color: '#fff',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
};
const headerTitleStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700,
};
const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
};
const cardsRowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
};
const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px 16px',
  border: '1px solid rgba(255,255,255,0.1)',
};
const badgeRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
};
const badgeStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
  background: '#6c5ce7', color: '#fff',
};
const badgeSubStyle: React.CSSProperties = {
  fontSize: 10, color: 'rgba(255,255,255,0.5)',
};
const cardTitleStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, margin: '0 0 8px',
};
const cardDescStyle: React.CSSProperties = {
  fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)', margin: '0 0 12px',
};
const checkListStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16,
};
const checkItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.8)',
};
const primaryBtnStyle: React.CSSProperties = {
  width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #9178BD, #6c5ce7)', color: '#fff',
  fontSize: 13, fontWeight: 600,
};
const outlineBtnStyle: React.CSSProperties = {
  width: '100%', padding: '10px 0', borderRadius: 10, cursor: 'pointer',
  background: 'transparent', color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.25)',
  fontSize: 13, fontWeight: 500,
};
