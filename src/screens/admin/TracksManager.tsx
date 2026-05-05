import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IoAdd,
  IoCreateOutline,
  IoTrashOutline,
  IoCloudUploadOutline,
  IoMusicalNotes,
} from 'react-icons/io5';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { colors } from '../../theme/colors';
import { formatDuration } from '../../types/track';
import { uploadToR2, isR2Configured } from '../../services/r2Upload';

interface TrackDoc {
  id: string;
  title: string;
  artist: string;
  duration: number;
  artworkUrl: string;
  audioUrl: string;
  previewUrl: string;
  description: string;
  order: number;
  paidMusic: boolean;
  frequencyMode: boolean;
  melodyMode: boolean;
  earphoneOptimized: boolean;
  speakerOptimized: boolean;
  noiseLevel: number;
  toneCharacter: number;
  rhythmIntensity: number;
  justIntonation: boolean;
  equalTemperament: boolean;
  rootFrequency: string;
  brainwaveEntrainment: string;
  pinkNoiseFluctuation: boolean;
}

const COLLECTION = 'sound';

export function TracksManager() {
  const [tracks, setTracks] = useState<TrackDoc[]>([]);
  const [editing, setEditing] = useState<TrackDoc | 'new' | null>(null);

  useEffect(() => {
    const q = query(collection(getFirestore(), COLLECTION), orderBy('level', 'asc'));
    return onSnapshot(q, (snap) => {
      setTracks(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.sound_name ?? data.title ?? '',
          artist: data.artist ?? 'Flux Ring',
          duration: typeof data.length === 'number' ? data.length : 0,
          artworkUrl: data.thumnail ?? '',
          audioUrl: data.sound ?? '',
          previewUrl: data.preview ?? '',
          description: data.comment ?? '',
          order: data.level ?? 0,
          paidMusic: data.paid_music === true,
          frequencyMode: data.frequency_mode === true,
          melodyMode: data.melody_mode === true,
          earphoneOptimized: data.earphone_optimized === true,
          speakerOptimized: data.speaker_optimized === true,
          noiseLevel: data.noise_level ?? 50,
          toneCharacter: data.tone_character ?? 50,
          rhythmIntensity: data.rhythm_intensity ?? 50,
          justIntonation: data.just_intonation === true,
          equalTemperament: data.equal_temperament !== false,
          rootFrequency: data.root_frequency ?? '440',
          brainwaveEntrainment: data.brainwave_entrainment ?? 'OFF',
          pinkNoiseFluctuation: data.pink_noise_fluctuation === true,
        };
      }));
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('この楽曲を削除しますか？')) return;
    await deleteDoc(doc(getFirestore(), COLLECTION, id));
  }, []);

  if (editing) {
    return <TrackEditor track={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;
  }

  return (
    <div>
      <div style={toolbarStyle}>
        <span style={countStyle}>{tracks.length} 曲</span>
        <button type="button" onClick={() => setEditing('new')} style={addBtnStyle}>
          <IoAdd size={16} /> 新規追加
        </button>
      </div>

      {tracks.map((t) => (
        <div key={t.id} style={rowStyle}>
          {t.artworkUrl ? (
            <img src={t.artworkUrl} alt="" style={rowThumbStyle} />
          ) : (
            <div style={{ ...rowThumbStyle, background: 'linear-gradient(135deg,#e0d8f0,#c8bde5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IoMusicalNotes size={18} color={colors.textSecondary} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={rowTitleStyle}>{t.title}</div>
            <div style={rowMetaStyle}>
              {t.artist} · {formatDuration(t.duration)} · Lv{t.order}
              {t.paidMusic && <span style={paidTagStyle}>有料</span>}
            </div>
          </div>
          <div style={rowActionsStyle}>
            <button type="button" onClick={() => setEditing(t)} style={iconBtn} title="編集">
              <IoCreateOutline size={16} color={colors.primary} />
            </button>
            <button type="button" onClick={() => handleDelete(t.id)} style={iconBtn} title="削除">
              <IoTrashOutline size={16} color="#c25a65" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Track Editor ── */
function TrackEditor({ track, onDone }: { track: TrackDoc | null; onDone: () => void }) {
  const [title, setTitle] = useState(track?.title ?? '');
  const [artist, setArtist] = useState(track?.artist ?? 'Flux Ring');
  const [duration, setDuration] = useState(track ? formatDuration(track.duration) : '00:00');
  const [description, setDescription] = useState(track?.description ?? '');
  const [order, setOrder] = useState(track?.order ?? 0);
  const [paidMusic, setPaidMusic] = useState(track?.paidMusic ?? false);

  // Mode & env
  const [frequencyMode, setFrequencyMode] = useState(track?.frequencyMode ?? false);
  const [melodyMode, setMelodyMode] = useState(track?.melodyMode ?? false);
  const [earphoneOpt, setEarphoneOpt] = useState(track?.earphoneOptimized ?? true);
  const [speakerOpt, setSpeakerOpt] = useState(track?.speakerOptimized ?? true);

  // Sliders
  const [noiseLevel, setNoiseLevel] = useState(track?.noiseLevel ?? 50);
  const [toneChar, setToneChar] = useState(track?.toneCharacter ?? 50);
  const [rhythmInt, setRhythmInt] = useState(track?.rhythmIntensity ?? 50);

  // Advanced
  const [justInton, setJustInton] = useState(track?.justIntonation ?? false);
  const [equalTemp, setEqualTemp] = useState(track?.equalTemperament ?? true);
  const [rootFreq, setRootFreq] = useState(track?.rootFrequency ?? '440');
  const [brainwave, setBrainwave] = useState(track?.brainwaveEntrainment ?? 'OFF');
  const [pinkNoise, setPinkNoise] = useState(track?.pinkNoiseFluctuation ?? false);

  // File uploads
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState(track?.artworkUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentR2Url, setCurrentR2Url] = useState(track?.audioUrl ?? '');
  const audioRef = useRef<HTMLInputElement>(null);
  const artworkRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLInputElement>(null);

  const parseDur = (s: string) => {
    const p = s.split(':');
    return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : parseInt(s) || 0;
  };

  const uploadFile = async (file: File, path: string) => {
    const storageRef = ref(getStorage(), path);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const db = getFirestore();
      const payload: Record<string, unknown> = {
        sound_name: title.trim(),
        artist: artist.trim(),
        length: parseDur(duration),
        comment: description.trim(),
        level: order,
        paid_music: paidMusic,
        frequency_mode: frequencyMode,
        melody_mode: melodyMode,
        earphone_optimized: earphoneOpt,
        speaker_optimized: speakerOpt,
        noise_level: noiseLevel,
        tone_character: toneChar,
        rhythm_intensity: rhythmInt,
        just_intonation: justInton,
        equal_temperament: equalTemp,
        root_frequency: rootFreq,
        brainwave_entrainment: brainwave,
        pink_noise_fluctuation: pinkNoise,
      };

      let docId = track?.id;
      if (track) {
        await updateDoc(doc(db, COLLECTION, track.id), payload);
      } else {
        payload.createdAt = serverTimestamp();
        const r = await addDoc(collection(db, COLLECTION), payload);
        docId = r.id;
      }

      if (docId) {
        if (audioFile) {
          if (!isR2Configured()) {
            throw new Error('R2 upload is not configured. Set VITE_R2_UPLOAD_ENDPOINT and VITE_R2_ADMIN_TOKEN in .env');
          }
          const { publicUrl } = await uploadToR2(audioFile, docId, 'audio', setAudioProgress);
          await updateDoc(doc(db, COLLECTION, docId), { r2_url: publicUrl });
          setCurrentR2Url(publicUrl);
        }
        if (artworkFile) {
          const ext = artworkFile.name.split('.').pop() ?? 'jpg';
          const url = await uploadFile(artworkFile, `sounds/${docId}/artwork.${ext}`);
          await updateDoc(doc(db, COLLECTION, docId), { thumnail: url });
        }
        if (previewFile) {
          const ext = previewFile.name.split('.').pop() ?? 'mp3';
          const url = await uploadFile(previewFile, `sounds/${docId}/preview.${ext}`);
          await updateDoc(doc(db, COLLECTION, docId), { preview: url });
        }
      }

      onDone();
    } catch (err) {
      console.error('Save failed', err);
      alert('保存に失敗しました。');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={handleSave} style={editorStyle}>
      <div style={editorHeaderStyle}>
        <h3 style={editorTitleStyle}>{track ? '楽曲を編集' : '新規楽曲追加'}</h3>
        <button type="button" onClick={onDone} style={cancelStyle}>キャンセル</button>
      </div>

      {/* Basic info */}
      <fieldset style={fieldsetStyle}><legend style={legendStyle}>基本情報</legend>
        <Row label="タイトル *"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} /></Row>
        <Row label="アーティスト"><input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} style={inputStyle} /></Row>
        <Row label="再生時間 (mm:ss)"><input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle} placeholder="03:45" /></Row>
        <Row label="表示順 (level)">
          <div style={levelRadioGroupStyle}>
            {[1, 2, 3, 4, 5].map((lv) => (
              <label key={lv} style={levelRadioLabelStyle}>
                <input type="radio" name="level" value={lv} checked={order === lv} onChange={() => setOrder(lv)} style={levelRadioInputStyle} />
                <span style={levelRadioBadgeStyle(order === lv)}>{lv}</span>
              </label>
            ))}
          </div>
        </Row>
        <Row label="説明"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} /></Row>
        <Toggle label="有料楽曲 (paid_music)" checked={paidMusic} onChange={setPaidMusic} />
      </fieldset>

      {/* Files */}
      <fieldset style={fieldsetStyle}><legend style={legendStyle}>ファイル</legend>
        <div style={fieldRowStyle}>
          <span style={fieldLblStyle}>音源ファイル (R2)</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => audioRef.current?.click()} style={filePickBtnStyle}>
                <IoCloudUploadOutline size={14} /> {audioFile ? audioFile.name : 'ファイルを選択'}
              </button>
              {!audioFile && currentR2Url && <span style={{ fontSize: 10, color: '#5a9e6e' }}>R2に設定済み</span>}
              <input ref={audioRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={(e) => {
                const f = e.target.files?.[0]; if (f) setAudioFile(f);
              }} />
            </div>
            {audioProgress > 0 && audioProgress < 1 && (
              <div style={progressBarStyle}><div style={{ ...progressFillStyle, width: `${audioProgress * 100}%` }} /></div>
            )}
            {!isR2Configured() && (
              <span style={{ fontSize: 10, color: '#c25a65' }}>
                ⚠ R2 アップロード未設定 (Vercel に VITE_R2_UPLOAD_ENDPOINT を設定)
              </span>
            )}
          </div>
        </div>
        <FileRow label="プレビュー音源" accept="audio/*" fileRef={previewRef} file={previewFile} currentUrl={track?.previewUrl} onFile={setPreviewFile} />
        <div style={fieldRowStyle}>
          <span style={fieldLblStyle}>サムネイル画像</span>
          <div style={{ flex: 1 }}>
            <div style={uploadAreaStyle} onClick={() => artworkRef.current?.click()}>
              {artworkPreview ? <img src={artworkPreview} alt="" style={artPreviewImgStyle} /> : (
                <div style={uploadPlaceholderStyle}><IoCloudUploadOutline size={22} color={colors.textSecondary} /><span>画像を選択</span></div>
              )}
            </div>
            <input ref={artworkRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
              const f = e.target.files?.[0]; if (f) { setArtworkFile(f); setArtworkPreview(URL.createObjectURL(f)); }
            }} />
          </div>
        </div>
      </fieldset>

      {/* Mode & env */}
      <fieldset style={fieldsetStyle}><legend style={legendStyle}>モード・再生環境</legend>
        <Toggle label="空間調律 (frequency_mode)" checked={frequencyMode} onChange={setFrequencyMode} />
        <Toggle label="空間演出 (melody_mode)" checked={melodyMode} onChange={setMelodyMode} />
        <Toggle label="イヤホン最適化 (earphone_optimized)" checked={earphoneOpt} onChange={setEarphoneOpt} />
        <Toggle label="スピーカー最適化 (speaker_optimized)" checked={speakerOpt} onChange={setSpeakerOpt} />
      </fieldset>

      {/* Space tuning */}
      <fieldset style={fieldsetStyle}><legend style={legendStyle}>空間調律パラメータ</legend>
        <SliderField label="ノイズレベル (noise_level)" value={noiseLevel} onChange={setNoiseLevel} leftLabel="Low" rightLabel="High" />
        <SliderField label="音色特性 (tone_character)" value={toneChar} onChange={setToneChar} leftLabel="Cool" rightLabel="Warm" />
        <SliderField label="リズム調整 (rhythm_intensity)" value={rhythmInt} onChange={setRhythmInt} leftLabel="Ambient" rightLabel="Rhythmic" />
      </fieldset>

      {/* Advanced */}
      <fieldset style={fieldsetStyle}><legend style={legendStyle}>深層設定 — Advanced Protocol</legend>
        <Toggle label="純正律 (just_intonation)" checked={justInton} onChange={setJustInton} />
        <Toggle label="平均律 (equal_temperament)" checked={equalTemp} onChange={setEqualTemp} />
        <Row label="Root Frequency">
          <select value={rootFreq} onChange={(e) => setRootFreq(e.target.value)} style={selectStyle}>
            <option value="432">432 Hz</option><option value="440">440 Hz</option>
            <option value="528">528 Hz</option><option value="639">639 Hz</option>
            <option value="741">741 Hz</option><option value="852">852 Hz</option>
          </select>
        </Row>
        <Row label="脳波同調">
          <select value={brainwave} onChange={(e) => setBrainwave(e.target.value)} style={selectStyle}>
            <option value="OFF">OFF</option><option value="Alpha">Alpha</option>
            <option value="Theta">Theta</option><option value="Delta">Delta</option>
          </select>
        </Row>
        <Toggle label="1/f ゆらぎ (pink_noise_fluctuation)" checked={pinkNoise} onChange={setPinkNoise} />
      </fieldset>

      <button type="submit" disabled={busy} style={saveBtnStyle}>
        {busy ? '保存中...' : track ? '更新する' : '追加する'}
      </button>
    </form>
  );
}

/* ── Sub-components ── */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={fieldRowStyle}><span style={fieldLblStyle}>{label}</span><div style={{ flex: 1 }}>{children}</div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={fieldRowStyle}>
      <span style={fieldLblStyle}>{label}</span>
      <button type="button" onClick={() => onChange(!checked)} style={{ ...toggleTrackStyle, background: checked ? colors.primary : 'rgba(200,195,215,0.5)' }}>
        <div style={{ ...toggleKnobStyle, transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}

function SliderField({ label, value, onChange, leftLabel, rightLabel }: { label: string; value: number; onChange: (v: number) => void; leftLabel: string; rightLabel: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ ...fieldLblStyle, marginBottom: 6 }}>{label}: {value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: colors.textSecondary, width: 50 }}>{leftLabel}</span>
        <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="gradient-slider" style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: colors.textSecondary, width: 50, textAlign: 'right' }}>{rightLabel}</span>
      </div>
    </div>
  );
}

function FileRow({ label, accept, fileRef, file, currentUrl, onFile }: {
  label: string; accept: string; fileRef: React.RefObject<HTMLInputElement | null>; file: File | null; currentUrl?: string; onFile: (f: File) => void;
}) {
  return (
    <div style={fieldRowStyle}>
      <span style={fieldLblStyle}>{label}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => fileRef.current?.click()} style={filePickBtnStyle}>
          <IoCloudUploadOutline size={14} /> {file ? file.name : 'ファイルを選択'}
        </button>
        {!file && currentUrl && <span style={{ fontSize: 10, color: colors.textSecondary }}>設定済み</span>}
        <input ref={fileRef} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </div>
    </div>
  );
}

/* ── Styles ── */
const toolbarStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 };
const countStyle: React.CSSProperties = { fontSize: 12, color: colors.textSecondary };
const addBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: `linear-gradient(135deg, #a388c8, ${colors.primary})`, color: '#fff', fontSize: 12, fontWeight: 600,
};
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, marginBottom: 6,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
};
const rowThumbStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 };
const rowTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: colors.textPrimary };
const rowMetaStyle: React.CSSProperties = { fontSize: 11, color: colors.textSecondary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 };
const paidTagStyle: React.CSSProperties = { fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,179,60,0.15)', color: '#c08920' };
const rowActionsStyle: React.CSSProperties = { display: 'flex', gap: 4, flexShrink: 0 };
const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)' };

const editorStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 22px', borderRadius: 16,
  background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.7)',
};
const editorHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const editorTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: colors.textPrimary, margin: 0 };
const cancelStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: colors.textSecondary };
const fieldsetStyle: React.CSSProperties = { border: '1px solid rgba(200,190,220,0.2)', borderRadius: 12, padding: '14px 16px', margin: 0, display: 'flex', flexDirection: 'column', gap: 10 };
const legendStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: colors.primary, padding: '0 6px' };
const fieldRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
const fieldLblStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: colors.textPrimary, flexShrink: 0 };
const inputStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(200,190,220,0.3)', background: 'rgba(255,255,255,0.75)', fontSize: 13, color: colors.textPrimary, outline: 'none', width: '100%' };
const selectStyle: React.CSSProperties = { fontSize: 12, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,190,220,0.3)', color: colors.textPrimary, outline: 'none' };
const toggleTrackStyle: React.CSSProperties = { width: 40, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', padding: 3, transition: 'background 0.2s', boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.1)' };
const toggleKnobStyle: React.CSSProperties = { width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.2s' };
const uploadAreaStyle: React.CSSProperties = { borderRadius: 8, border: '2px dashed rgba(200,190,220,0.4)', background: 'rgba(255,255,255,0.5)', cursor: 'pointer', overflow: 'hidden', minHeight: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const uploadPlaceholderStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 12, fontSize: 10, color: colors.textSecondary };
const artPreviewImgStyle: React.CSSProperties = { width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' };
const filePickBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
  border: '1px solid rgba(200,190,220,0.3)', background: 'rgba(255,255,255,0.6)', cursor: 'pointer',
  fontSize: 11, color: colors.textPrimary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const saveBtnStyle: React.CSSProperties = {
  padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: `linear-gradient(135deg, #a388c8, ${colors.primary})`, color: '#fff', fontSize: 14, fontWeight: 600,
};

const progressBarStyle: React.CSSProperties = {
  width: '100%', height: 4, borderRadius: 2,
  background: 'rgba(200,190,220,0.3)', overflow: 'hidden',
};
const progressFillStyle: React.CSSProperties = {
  height: '100%',
  background: `linear-gradient(90deg, #a388c8, ${colors.primary})`,
  transition: 'width 0.2s',
};

const levelRadioGroupStyle: React.CSSProperties = {
  display: 'flex', gap: 6,
};
const levelRadioLabelStyle: React.CSSProperties = {
  cursor: 'pointer', display: 'flex',
};
const levelRadioInputStyle: React.CSSProperties = {
  position: 'absolute', opacity: 0, width: 0, height: 0,
};
const levelRadioBadgeStyle = (active: boolean): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 14, fontWeight: 700,
  background: active ? colors.primary : 'rgba(255,255,255,0.6)',
  color: active ? '#fff' : colors.textPrimary,
  border: active ? 'none' : '1px solid rgba(200,190,220,0.3)',
  boxShadow: active ? '0 2px 8px rgba(145,120,189,0.35)' : 'none',
  transition: 'all 0.15s',
});
