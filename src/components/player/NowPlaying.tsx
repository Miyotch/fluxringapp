import React, { useState } from 'react';
import {
  IoChevronBack,
  IoPlay,
  IoPause,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoRepeat,
  IoShuffle,
  IoClose,
  IoArrowForward,
  IoDiamondOutline,
} from 'react-icons/io5';
import { FaCrown } from 'react-icons/fa';
import type { Track } from '../../types/track';
import { formatDuration } from '../../types/track';
import { CustomOrderModal } from './CustomOrderModal';
import { useUserPlan } from '../../hooks/useUserPlan';

interface NowPlayingProps {
  track: Track;
  isPlaying: boolean;
  position: number;
  duration: number;
  repeat: boolean;
  onTogglePlay: () => void;
  onToggleRepeat: () => void;
  onSeek: (seconds: number) => void;
  onClose: () => void;
}

export function NowPlaying({
  track,
  isPlaying,
  position,
  duration,
  repeat,
  onTogglePlay,
  onToggleRepeat,
  onSeek,
  onClose,
}: NowPlayingProps) {
  const { planId } = useUserPlan();
  const isPremium = planId === 'premium';
  const [showUpsell, setShowUpsell] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const progress = duration > 0 ? position / duration : 0;

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    // Wait for fade-out animation to finish before unmounting
    window.setTimeout(onClose, 420);
  };

  return (
    <div style={{ ...containerStyle, ...(isClosing ? containerClosingStyle : null) }}>
      {/* Background: full artwork image, no blur */}
      <div style={bgStyle}>
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt=""
            style={{ ...bgImgStyle, ...(isClosing ? bgImgClosingStyle : null) }}
          />
        ) : (
          <div style={{ ...bgImgStyle, background: 'linear-gradient(135deg, #2a2a3e, #1a1a2e)' }} />
        )}
        <div style={bgOverlayStyle} />
      </div>

      {/* Top bar */}
      <div style={{ ...topBarStyle, ...(isClosing ? topBarClosingStyle : null) }}>
        <button onClick={handleClose} style={iconBtnStyle} type="button">
          <IoChevronBack size={24} color="#fff" />
        </button>
        {isPremium ? (
          <div style={vipBadgeStyle}>
            <IoDiamondOutline size={14} color="#fff" />
            <span style={vipLabelStyle}>VIP</span>
          </div>
        ) : (
          <button
            onClick={() => setShowUpsell(true)}
            style={crownBtnStyle}
            type="button"
            aria-label="カスタム制作を見る"
          >
            <FaCrown size={18} color="#FFD54A" />
          </button>
        )}
      </div>

      {/* Commercial use notice (standard plan only) */}
      {!isPremium && (
        <div style={commercialNoticeStyle}>
          商用利用はプレミアム機能限定です
        </div>
      )}

      {/* Spacer: pushes controls to bottom */}
      <div style={{ flex: 1 }} />

      {/* Bottom controls — centered, constrained width */}
      <div style={{ ...bottomStyle, ...(isClosing ? bottomClosingStyle : null) }}>
        <div style={bottomInnerStyle}>
          {/* Track info */}
          <div style={infoStyle}>
            <div style={titleStyle}>{track.title}</div>
            <div style={artistStyle}>{track.artist}</div>
          </div>

          {/* Progress bar */}
          <div style={progressContainerStyle}>
            <div
              style={progressBarBgStyle}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                onSeek(ratio * duration);
              }}
            >
              <div style={{ ...progressBarFillStyle, width: `${progress * 100}%` }} />
              <div style={{ ...progressKnobStyle, left: `${progress * 100}%` }} />
            </div>
            <div style={timeRowStyle}>
              <span style={timeStyle}>{formatDuration(Math.floor(position))}</span>
              <span style={timeStyle}>{formatDuration(Math.floor(duration))}</span>
            </div>
          </div>

          {/* Playback controls */}
          <div style={controlsStyle}>
            <button
              onClick={onToggleRepeat}
              style={iconBtnStyle}
              type="button"
              aria-label={repeat ? 'リピートをオフ' : 'リピートをオン'}
            >
              <IoRepeat
                size={20}
                color={repeat ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
              {repeat && <div style={repeatDotStyle} />}
            </button>
            <button style={iconBtnStyle} type="button">
              <IoPlaySkipBack size={24} color="#fff" />
            </button>
            <button onClick={onTogglePlay} style={playBtnStyle} type="button">
              {isPlaying ? (
                <IoPause size={28} color="#fff" />
              ) : (
                <IoPlay size={28} color="#fff" style={{ marginLeft: 3 }} />
              )}
            </button>
            <button style={iconBtnStyle} type="button">
              <IoPlaySkipForward size={24} color="#fff" />
            </button>
            <button style={iconBtnStyle} type="button">
              <IoShuffle size={20} color="rgba(255,255,255,0.5)" />
            </button>
          </div>
        </div>
      </div>

      {/* Upsell popover */}
      {showUpsell && (
        <div style={upsellOverlayStyle} onClick={() => setShowUpsell(false)}>
          <div style={upsellCardStyle} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowUpsell(false)}
              style={upsellCloseStyle}
              type="button"
            >
              <IoClose size={18} color="rgba(255,255,255,0.7)" />
            </button>
            <div style={upsellIconWrapStyle}>
              <FaCrown size={36} color="#FFD54A" />
            </div>
            <h3 style={upsellTitleStyle}>
              アプリで探せない<br />『究極の1曲』を。
            </h3>
            <p style={upsellDescStyle}>
              あなたのブランド専用の周波数制作はこちら
            </p>
            <button
              onClick={() => {
                setShowUpsell(false);
                setShowOrderModal(true);
              }}
              style={upsellCtaStyle}
              type="button"
            >
              カスタム制作を見る <IoArrowForward size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Custom order modal */}
      {showOrderModal && (
        <CustomOrderModal
          track={track}
          onClose={() => setShowOrderModal(false)}
        />
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  display: 'flex', flexDirection: 'column',
  color: '#fff',
  animation: 'nowPlayingFadeIn 0.6s ease-out',
};
const containerClosingStyle: React.CSSProperties = {
  animation: 'nowPlayingFadeOut 0.42s ease-in forwards',
};
const bgStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, overflow: 'hidden',
};
const bgImgStyle: React.CSSProperties = {
  width: '100%', height: '100%', objectFit: 'cover',
  animation: 'nowPlayingBgFadeIn 0.9s ease-out',
};
const bgImgClosingStyle: React.CSSProperties = {
  animation: 'nowPlayingBgFadeOut 0.42s ease-in forwards',
};
const bgOverlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0,
  background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.55) 100%)',
};
const topBarStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 24px',
  animation: 'nowPlayingContentFadeIn 0.7s ease-out 0.1s backwards',
};
const topBarClosingStyle: React.CSSProperties = {
  animation: 'nowPlayingContentFadeOut 0.38s ease-in forwards',
};
const bottomStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  display: 'flex', justifyContent: 'center',
  padding: '0 24px 48px',
  animation: 'nowPlayingContentFadeIn 0.8s ease-out 0.15s backwards',
};
const bottomClosingStyle: React.CSSProperties = {
  animation: 'nowPlayingContentFadeOut 0.38s ease-in forwards',
};
const bottomInnerStyle: React.CSSProperties = {
  width: '100%', maxWidth: 420,
};
const infoStyle: React.CSSProperties = {
  textAlign: 'center', marginBottom: 20,
};
const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, marginBottom: 4,
  textShadow: '0 1px 4px rgba(0,0,0,0.4)',
};
const artistStyle: React.CSSProperties = {
  fontSize: 13, opacity: 0.7,
  textShadow: '0 1px 3px rgba(0,0,0,0.3)',
};
const progressContainerStyle: React.CSSProperties = {
  marginBottom: 20,
};
const progressBarBgStyle: React.CSSProperties = {
  position: 'relative', height: 3, borderRadius: 2, cursor: 'pointer',
  background: 'rgba(255,255,255,0.25)',
};
const progressBarFillStyle: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2,
  background: '#fff',
};
const progressKnobStyle: React.CSSProperties = {
  position: 'absolute', top: '50%', width: 10, height: 10, borderRadius: '50%',
  background: '#fff', transform: 'translate(-50%, -50%)',
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};
const timeRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', marginTop: 6,
};
const timeStyle: React.CSSProperties = {
  fontSize: 11, opacity: 0.6,
};
const controlsStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28,
};
const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
};
const repeatDotStyle: React.CSSProperties = {
  position: 'absolute', bottom: 1, left: '50%',
  transform: 'translateX(-50%)',
  width: 3, height: 3, borderRadius: '50%', background: '#fff',
};
const playBtnStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
};

/* Gold crown button */
const crownBtnStyle: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,213,74,0.25), rgba(255,180,50,0.15))',
  border: '1px solid rgba(255,213,74,0.5)',
  borderRadius: '50%', width: 40, height: 40, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 2px 10px rgba(255,200,60,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
  transition: 'transform 0.15s',
};

/* Upsell popover */
const upsellOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 150,
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'searchFadeIn 0.3s ease-out',
};
const upsellCardStyle: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(160deg, #2a2438 0%, #1c1c2e 100%)',
  border: '1px solid rgba(255,213,74,0.3)',
  borderRadius: 20, padding: '36px 32px 28px',
  maxWidth: 380, width: '90%', textAlign: 'center',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,200,60,0.15)',
};
const upsellCloseStyle: React.CSSProperties = {
  position: 'absolute', top: 14, right: 14,
  background: 'rgba(255,255,255,0.08)', border: 'none',
  borderRadius: '50%', width: 28, height: 28, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const upsellIconWrapStyle: React.CSSProperties = {
  width: 72, height: 72, borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(255,213,74,0.25), rgba(255,180,50,0.05))',
  border: '1px solid rgba(255,213,74,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  margin: '0 auto 18px',
  boxShadow: '0 0 30px rgba(255,200,60,0.3)',
};
const upsellTitleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 10px',
  lineHeight: 1.5, letterSpacing: '0.02em',
};
const upsellDescStyle: React.CSSProperties = {
  fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 22px', lineHeight: 1.6,
};
const upsellCtaStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '12px 24px', borderRadius: 24, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #FFD54A, #FFB33C)',
  color: '#2a2438', fontSize: 13, fontWeight: 700,
  boxShadow: '0 4px 14px rgba(255,180,50,0.4)',
  letterSpacing: '0.03em',
};

/* VIP badge for premium users */
const vipBadgeStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '6px 14px', borderRadius: 20,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))',
  border: '1px solid rgba(255,255,255,0.35)',
  backdropFilter: 'blur(8px)',
};
const vipLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#fff',
  letterSpacing: '0.12em',
};

/* Commercial use notice for standard plan */
const commercialNoticeStyle: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  textAlign: 'center',
  fontSize: 10, fontWeight: 500, letterSpacing: '0.03em',
  color: 'rgba(255,255,255,0.55)',
  padding: '0 24px',
};
