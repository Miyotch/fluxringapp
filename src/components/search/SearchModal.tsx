import React, { useState, useCallback } from 'react';
import {
  IoClose,
  IoSearchOutline,
  IoChevronDown,
  IoChevronUp,
} from 'react-icons/io5';
import { colors } from '../../theme/colors';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

const QUICK_TAGS = ['#528Hz', '#安眠', '#集中', '#浄化', '#自然音', '#ピアノ', '#瞑想', '#リラックス'];

export function SearchModal({ visible, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [noiseLevel, setNoiseLevel] = useState(50);
  const [tone, setTone] = useState(50);
  const [texture, setTexture] = useState(50);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [frequency, setFrequency] = useState('432');
  const [scale, setScale] = useState('ペンタトニック');

  const handleTagClick = useCallback((tag: string) => {
    setQuery((prev) => {
      const clean = tag.replace('#', '');
      return prev.includes(clean) ? prev : (prev ? prev + ' ' + clean : clean);
    });
  }, []);

  const handleDirectSubmit = useCallback(() => {
    console.log('Direct navigation search:', query);
    // TODO: wire to real search
  }, [query]);

  const handleQuickSubmit = useCallback(() => {
    console.log('Quick solution:', { noiseLevel, tone, texture });
    // TODO: wire to real search
  }, [noiseLevel, tone, texture]);

  const handlePersonalizedSubmit = useCallback(() => {
    console.log('Personalized solution:', { frequency, scale });
    // TODO: wire to real search
  }, [frequency, scale]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop — fades in */}
      <div style={backdropStyle} onClick={onClose} />

      {/* Panel — full width, fade in */}
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h2 style={headerTitleStyle}>サーチ</h2>
          <button onClick={onClose} style={closeBtnStyle} type="button">
            <IoClose size={22} color={colors.textPrimary} />
          </button>
        </div>

        <div style={scrollStyle}>
          <div style={contentWrapperStyle}>
            {/* ── Section 1: Direct Navigation ── */}
            <div style={sectionStyle}>
              <div style={sectionLabelStyle}>ダイレクト・ナビゲーション</div>

              {/* Search bar */}
              <div style={searchBarStyle}>
                <IoSearchOutline size={18} color={colors.textSecondary} />
                <input
                  type="text"
                  placeholder="例: 「深い眠り」「集中力を高める」"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {/* Quick tags */}
              <div style={tagsRowStyle}>
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    style={tagStyle}
                    type="button"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Confirm button */}
              <button
                onClick={handleDirectSubmit}
                style={confirmBtnStyle}
                type="button"
              >
                決定
              </button>
            </div>

            {/* ── Section 2: Quick Solution – Sliders ── */}
            <div style={sectionStyle}>
              <div style={sectionLabelStyle}>クイック・ソリューション</div>
              <p style={sectionDescStyle}>
                スライダー操作で、言葉にできない「今の空気感」を即座に音へ反映。
              </p>

              <SliderRow
                label="周囲のノイズレベル"
                leftLabel="Low"
                rightLabel="High"
                value={noiseLevel}
                onChange={setNoiseLevel}
              />
              <SliderRow
                label="音色特性（Tone）"
                leftLabel="Cool"
                rightLabel="Warm"
                value={tone}
                onChange={setTone}
              />
              <SliderRow
                label="時間軸（Texture）"
                leftLabel="Ambient"
                rightLabel="Rhythmic"
                value={texture}
                onChange={setTexture}
              />

              {/* Confirm button */}
              <button
                onClick={handleQuickSubmit}
                style={confirmBtnStyle}
                type="button"
              >
                決定
              </button>
            </div>

            {/* ── Section 3: Personalized Solution ── */}
            <div style={sectionStyle}>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={advancedToggleStyle}
                type="button"
              >
                <span style={sectionLabelStyle}>パーソナライズ・ソリューション</span>
                {showAdvanced ? (
                  <IoChevronUp size={18} color={colors.textSecondary} />
                ) : (
                  <IoChevronDown size={18} color={colors.textSecondary} />
                )}
              </button>
              <p style={sectionDescStyle}>
                アドバンスド設定 — 周波数指定、音階・スケール選択など。
              </p>

              {showAdvanced && (
                <>
                  <div style={advancedContentStyle}>
                    <div style={advancedRowStyle}>
                      <label style={advancedLabelStyle}>周波数 (Hz)</label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        style={selectStyle}
                      >
                        <option value="432">432 Hz</option>
                        <option value="440">440 Hz</option>
                        <option value="528">528 Hz (ソルフェジオ)</option>
                        <option value="639">639 Hz</option>
                        <option value="741">741 Hz</option>
                      </select>
                    </div>
                    <div style={advancedRowStyle}>
                      <label style={advancedLabelStyle}>スケール</label>
                      <select
                        value={scale}
                        onChange={(e) => setScale(e.target.value)}
                        style={selectStyle}
                      >
                        <option value="ペンタトニック">ペンタトニック</option>
                        <option value="メジャー">メジャー</option>
                        <option value="マイナー">マイナー</option>
                        <option value="ドリアン">ドリアン</option>
                        <option value="ミクソリディアン">ミクソリディアン</option>
                      </select>
                    </div>
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handlePersonalizedSubmit}
                    style={confirmBtnStyle}
                    type="button"
                  >
                    決定
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Slider sub-component ── */
function SliderRow({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={sliderContainerStyle}>
      <div style={sliderLabelStyle}>{label}</div>
      <div style={sliderTrackRowStyle}>
        <span style={sliderEndLabelStyle}>{leftLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="gradient-slider"
          style={sliderInputStyle}
        />
        <span style={sliderEndLabelStyle}>{rightLabel}</span>
      </div>
    </div>
  );
}

/* ── Styles ── */

const backdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(0,0,0,0.2)',
  animation: 'searchFadeIn 0.35s ease-out',
};

const panelStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  zIndex: 301,
  background: 'rgba(230, 235, 241, 0.94)',
  backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  display: 'flex', flexDirection: 'column',
  animation: 'searchPanelFadeIn 0.4s ease-out',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '20px 32px 16px',
  borderBottom: '1px solid rgba(200,190,220,0.2)',
};
const headerTitleStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: 0,
};
const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '50%', width: 36, height: 36, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '2px 2px 6px rgba(174,164,204,0.15), -1px -1px 4px rgba(255,255,255,0.7)',
};
const scrollStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto',
};
const contentWrapperStyle: React.CSSProperties = {
  maxWidth: 720, margin: '0 auto',
  padding: '24px 32px 40px',
};
const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
  padding: '20px 24px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.4)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '3px 3px 12px rgba(174,164,204,0.1), -2px -2px 8px rgba(255,255,255,0.6)',
};
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: colors.textPrimary, margin: '0 0 8px',
};
const sectionDescStyle: React.CSSProperties = {
  fontSize: 11, color: colors.textSecondary, lineHeight: 1.6, margin: '0 0 14px',
};
const searchBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: 'inset 1px 1px 3px rgba(174,164,204,0.1), 2px 2px 8px rgba(174,164,204,0.1)',
  marginBottom: 12,
};
const inputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent',
  fontSize: 14, color: colors.textPrimary,
};
const tagsRowStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16,
};
const tagStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 20,
  background: 'rgba(145,120,189,0.1)', border: '1px solid rgba(145,120,189,0.2)',
  color: colors.primary, cursor: 'pointer',
};

/* Slider */
const sliderContainerStyle: React.CSSProperties = {
  marginBottom: 20,
};
const sliderLabelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: colors.textPrimary, marginBottom: 10,
};
const sliderTrackRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14,
};
const sliderEndLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: colors.textSecondary, width: 56, flexShrink: 0,
  textAlign: 'center',
};
const sliderInputStyle: React.CSSProperties = {
  flex: 1,
};

/* Slider wrapper spacing */

/* Advanced */
const advancedToggleStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
  padding: '0 0 4px', marginBottom: 4,
};
const advancedContentStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 12,
  padding: '12px 14px', borderRadius: 12, marginBottom: 16,
  background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)',
};
const advancedRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
};
const advancedLabelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: colors.textPrimary,
};
const selectStyle: React.CSSProperties = {
  fontSize: 12, padding: '6px 10px', borderRadius: 8,
  background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,190,220,0.3)',
  color: colors.textPrimary, outline: 'none',
};

/* Confirm button */
const confirmBtnStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 8,
  padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #a388c8, #9178BD)',
  color: '#fff', fontSize: 13, fontWeight: 600,
  letterSpacing: '0.05em',
  boxShadow: '0 3px 10px rgba(145,120,189,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
  transition: 'transform 0.1s, box-shadow 0.15s',
};
