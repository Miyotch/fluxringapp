import React, { useState } from 'react';
import { IoClose, IoTrashOutline } from 'react-icons/io5';
import { OrbSphere } from '../ui/OrbSphere';
import { colors } from '../../theme/colors';

interface PlaylistEditModalProps {
  mode: 'add' | 'edit';
  playlist?: { id: string; name: string; hue: number };
  onSave: (name: string, hue: number, id?: string) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const HUE_PRESETS = [
  { label: 'パープル', hue: 280 },
  { label: 'バイオレット', hue: 260 },
  { label: 'ブルー', hue: 220 },
  { label: 'シアン', hue: 195 },
  { label: 'グリーン', hue: 150 },
  { label: 'ピンク', hue: 320 },
];

export function PlaylistEditModal({
  mode,
  playlist,
  onSave,
  onDelete,
  onClose,
}: PlaylistEditModalProps) {
  const [name, setName] = useState(playlist?.name ?? '');
  const [hue, setHue] = useState(playlist?.hue ?? 260);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave(name.trim(), hue, playlist?.id);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={headerTitleStyle}>
            {mode === 'add' ? 'プレイリストを作成' : 'プレイリストを編集'}
          </h2>
          <button onClick={onClose} style={closeBtnStyle} type="button">
            <IoClose size={20} color={colors.textSecondary} />
          </button>
        </div>

        {/* Orb preview */}
        <div style={previewStyle}>
          <OrbSphere size={96} hue={hue} />
        </div>

        {/* Name input */}
        <div style={fieldStyle}>
          <label style={labelStyle}>プレイリスト名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 集中モード"
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* Color selection */}
        <div style={fieldStyle}>
          <label style={labelStyle}>カラー</label>
          <div style={colorRowStyle}>
            {HUE_PRESETS.map((preset) => (
              <button
                key={preset.hue}
                onClick={() => setHue(preset.hue)}
                style={{
                  ...colorBtnStyle,
                  background: `hsl(${preset.hue}, 55%, 65%)`,
                  border: hue === preset.hue ? '3px solid #fff' : '2px solid transparent',
                  boxShadow: hue === preset.hue
                    ? `0 0 0 2px ${colors.primary}, 2px 2px 6px rgba(0,0,0,0.1)`
                    : '2px 2px 6px rgba(0,0,0,0.08)',
                }}
                type="button"
                title={preset.label}
              />
            ))}
          </div>
        </div>

        {/* Custom hue slider */}
        <div style={fieldStyle}>
          <label style={labelStyle}>カスタムカラー</label>
          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            style={sliderStyle}
          />
        </div>

        {/* Actions */}
        <div style={actionsStyle}>
          {mode === 'edit' && onDelete && playlist && (
            <button
              onClick={() => onDelete(playlist.id)}
              style={deleteBtnStyle}
              type="button"
            >
              <IoTrashOutline size={16} /> 削除
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={cancelBtnStyle} type="button">
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            style={{
              ...saveBtnStyle,
              opacity: name.trim() ? 1 : 0.4,
            }}
            disabled={!name.trim()}
            type="button"
          >
            {mode === 'add' ? '作成' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 400,
  background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'searchFadeIn 0.3s ease-out',
};
const modalStyle: React.CSSProperties = {
  background: '#E6EBF1', borderRadius: 20, padding: '28px 28px 20px',
  maxWidth: 400, width: '90%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
};
const headerTitleStyle: React.CSSProperties = {
  fontSize: 17, fontWeight: 700, color: colors.textPrimary, margin: 0,
};
const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const previewStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'center', marginBottom: 20,
};
const fieldStyle: React.CSSProperties = { marginBottom: 16 };
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: colors.textSecondary, display: 'block', marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: 'inset 1px 1px 3px rgba(174,164,204,0.1)',
  fontSize: 14, color: colors.textPrimary, outline: 'none',
  boxSizing: 'border-box',
};
const colorRowStyle: React.CSSProperties = {
  display: 'flex', gap: 10, flexWrap: 'wrap',
};
const colorBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', transition: 'border 0.15s, box-shadow 0.15s',
};
const sliderStyle: React.CSSProperties = {
  width: '100%', height: 6, appearance: 'none' as const,
  background: 'linear-gradient(90deg, hsl(0,60%,65%), hsl(60,60%,65%), hsl(120,60%,65%), hsl(180,60%,65%), hsl(240,60%,65%), hsl(300,60%,65%), hsl(360,60%,65%))',
  borderRadius: 3, outline: 'none',
};
const actionsStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, marginTop: 20,
};
const deleteBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500,
  color: '#e74c3c', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
};
const cancelBtnStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, color: colors.textSecondary,
  background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)',
  borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
};
const saveBtnStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#fff',
  background: colors.primary, border: 'none',
  borderRadius: 10, padding: '8px 20px', cursor: 'pointer',
  transition: 'opacity 0.15s',
};
