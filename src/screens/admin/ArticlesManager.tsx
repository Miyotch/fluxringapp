import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IoAdd,
  IoCreateOutline,
  IoTrashOutline,
  IoPin,
  IoPinOutline,
  IoEye,
  IoEyeOff,
  IoCloudUploadOutline,
  IoLinkOutline,
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
  Timestamp,
} from 'firebase/firestore';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { colors } from '../../theme/colors';
import { uploadArticleThumbnail } from '../../services/storage';

interface ArticleDoc {
  id: string;
  title: string;
  subtitle: string;
  descriptions: string;
  date: Date;
  published: boolean;
  stable: boolean;
  external_link: string;
  thumbnail: string;
}

const COLLECTION = 'article';

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'link', 'image'],
    ['clean'],
  ],
};

export function ArticlesManager() {
  const [articles, setArticles] = useState<ArticleDoc[]>([]);
  const [editing, setEditing] = useState<ArticleDoc | 'new' | null>(null);

  useEffect(() => {
    const q = query(collection(getFirestore(), COLLECTION), orderBy('date', 'desc'));
    return onSnapshot(q, (snap) => {
      const docs: ArticleDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title ?? '',
          subtitle: data.subtitle ?? '',
          descriptions: data.descriptions ?? '',
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(),
          published: data.published === true,
          stable: data.stable === true,
          external_link: data.external_link ?? '',
          thumbnail: data.thumbnail ?? '',
        };
      });
      docs.sort((a, b) => {
        if (a.stable !== b.stable) return a.stable ? -1 : 1;
        return b.date.getTime() - a.date.getTime();
      });
      setArticles(docs);
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('この記事を削除しますか？')) return;
    await deleteDoc(doc(getFirestore(), COLLECTION, id));
  }, []);

  const handleTogglePin = useCallback(async (article: ArticleDoc) => {
    await updateDoc(doc(getFirestore(), COLLECTION, article.id), { stable: !article.stable });
  }, []);

  const handleTogglePublish = useCallback(async (article: ArticleDoc) => {
    await updateDoc(doc(getFirestore(), COLLECTION, article.id), { published: !article.published });
  }, []);

  if (editing) {
    return (
      <ArticleEditor
        article={editing === 'new' ? null : editing}
        onDone={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div style={toolbarStyle}>
        <span style={countStyle}>{articles.length} 件の記事</span>
        <button type="button" onClick={() => setEditing('new')} style={addBtnStyle}>
          <IoAdd size={16} /> 新規作成
        </button>
      </div>

      {articles.map((a) => (
        <div key={a.id} style={{ ...articleRowStyle, opacity: a.published ? 1 : 0.55 }}>
          {a.thumbnail && <img src={a.thumbnail} alt="" style={rowThumbStyle} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={articleTitleRowStyle}>
              {a.stable && <IoPin size={13} color="#FFB33C" style={{ flexShrink: 0 }} />}
              <span style={articleTitleTextStyle}>{a.title}</span>
              {!a.published && <span style={draftTagStyle}>下書き</span>}
              {a.external_link && <IoLinkOutline size={13} color={colors.textSecondary} title="外部リンク" />}
            </div>
            {a.subtitle && <div style={articleSubtitleStyle}>{a.subtitle}</div>}
            <div style={articleDateStyle}>{a.date.toLocaleDateString('ja-JP')}</div>
          </div>
          <div style={articleActionsStyle}>
            <button type="button" onClick={() => handleTogglePublish(a)} style={iconBtn} title={a.published ? '非公開にする' : '公開する'}>
              {a.published ? <IoEye size={16} color="#5a9e6e" /> : <IoEyeOff size={16} color={colors.textSecondary} />}
            </button>
            <button type="button" onClick={() => handleTogglePin(a)} style={iconBtn} title={a.stable ? '固定解除' : '上に固定'}>
              {a.stable ? <IoPin size={16} color="#FFB33C" /> : <IoPinOutline size={16} color={colors.textSecondary} />}
            </button>
            <button type="button" onClick={() => setEditing(a)} style={iconBtn} title="編集">
              <IoCreateOutline size={16} color={colors.primary} />
            </button>
            <button type="button" onClick={() => handleDelete(a.id)} style={iconBtn} title="削除">
              <IoTrashOutline size={16} color="#c25a65" />
            </button>
          </div>
        </div>
      ))}

      {articles.length === 0 && (
        <p style={{ textAlign: 'center', color: colors.textSecondary, padding: 32, fontSize: 13 }}>
          まだ記事がありません。
        </p>
      )}
    </div>
  );
}

/* ── Article Editor ── */
function ArticleEditor({
  article,
  onDone,
}: {
  article: ArticleDoc | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [subtitle, setSubtitle] = useState(article?.subtitle ?? '');
  const [descriptions, setDescriptions] = useState(article?.descriptions ?? '');
  const [date, setDate] = useState(
    article ? article.date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [published, setPublished] = useState(article?.published ?? false);
  const [stable, setStable] = useState(article?.stable ?? false);
  const [externalLink, setExternalLink] = useState(article?.external_link ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(article?.thumbnail ?? '');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailUrl(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const db = getFirestore();
      const payload: Record<string, unknown> = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        descriptions,
        date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
        published,
        stable,
        external_link: externalLink.trim(),
      };

      let docId = article?.id;
      if (article) {
        await updateDoc(doc(db, COLLECTION, article.id), payload);
      } else {
        const ref = await addDoc(collection(db, COLLECTION), payload);
        docId = ref.id;
      }

      if (thumbnailFile && docId) {
        setUploading(true);
        const url = await uploadArticleThumbnail(thumbnailFile, docId);
        await updateDoc(doc(db, COLLECTION, docId), { thumbnail: url });
        setUploading(false);
      }

      onDone();
    } catch (err) {
      console.error('Save failed', err);
      alert('保存に失敗しました。');
    } finally { setBusy(false); setUploading(false); }
  };

  return (
    <div style={editorWrapStyle}>
      {/* Left: form */}
      <form onSubmit={handleSave} style={editorFormStyle}>
        <div style={editorHeaderStyle}>
          <h3 style={editorHeadingStyle}>{article ? '記事を編集' : '新規記事'}</h3>
          <button type="button" onClick={onDone} style={editorCancelStyle}>キャンセル</button>
        </div>

        <label style={fieldLabelStyle}>
          タイトル
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={fieldInputStyle} placeholder="記事タイトル" />
        </label>

        <label style={fieldLabelStyle}>
          サブタイトル (subtitle)
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} style={fieldInputStyle} placeholder="サブタイトル" />
        </label>

        <label style={fieldLabelStyle}>
          公開日 (date)
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldInputStyle} />
        </label>

        {/* Thumbnail upload */}
        <div style={fieldLabelStyle}>
          サムネイル画像 (thumbnail)
          <div style={uploadAreaStyle} onClick={() => fileRef.current?.click()}>
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="thumb" style={uploadPreviewStyle} />
            ) : (
              <div style={uploadPlaceholderStyle}>
                <IoCloudUploadOutline size={28} color={colors.textSecondary} />
                <span>クリックして画像を選択</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          {thumbnailUrl && (
            <button type="button" onClick={() => { setThumbnailUrl(''); setThumbnailFile(null); }} style={removeThumbBtnStyle}>
              サムネイルを削除
            </button>
          )}
        </div>

        {/* External link */}
        <label style={fieldLabelStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IoLinkOutline size={14} /> 外部リンク (external_link)
          </span>
          <input type="url" value={externalLink} onChange={(e) => setExternalLink(e.target.value)} style={fieldInputStyle} placeholder="https://note.com/..." />
        </label>

        {/* Rich text editor */}
        <div style={fieldLabelStyle}>
          本文 (descriptions)
          <div style={quillWrapStyle}>
            <ReactQuill
              theme="snow"
              value={descriptions}
              onChange={setDescriptions}
              modules={QUILL_MODULES}
              placeholder="記事の本文を入力してください"
            />
          </div>
        </div>

        <div style={checkRowStyle}>
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            {published ? <IoEye size={14} color="#5a9e6e" /> : <IoEyeOff size={14} color={colors.textSecondary} />}
            公開する (published)
          </label>
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={stable} onChange={(e) => setStable(e.target.checked)} />
            <IoPin size={14} color={stable ? '#FFB33C' : colors.textSecondary} />
            上部に固定 (stable)
          </label>
        </div>

        <button type="submit" disabled={busy || uploading} style={saveBtnStyle}>
          {uploading ? '画像アップロード中...' : busy ? '保存中...' : article ? '更新する' : '投稿する'}
        </button>
      </form>

      {/* Right: live preview */}
      <div style={previewPanelStyle}>
        <div style={previewLabelStyle}>プレビュー</div>
        <div style={previewCardStyle}>
          {thumbnailUrl && <img src={thumbnailUrl} alt="" style={previewThumbStyle} />}
          <div style={previewMetaStyle}>
            {stable && (
              <span style={previewPinBadgeStyle}><IoPin size={11} color="#fff" /> 固定</span>
            )}
            <span style={previewDateTextStyle}>{date}</span>
            {!published && <span style={previewDraftStyle}>下書き</span>}
            {externalLink && (
              <span style={previewLinkTagStyle}><IoLinkOutline size={11} /> 外部リンク</span>
            )}
          </div>
          <h2 style={previewHeadingStyle}>{title || '（タイトル未入力）'}</h2>
          {subtitle && <p style={previewSubtitleStyle}>{subtitle}</p>}
          {externalLink ? (
            <a href={externalLink} target="_blank" rel="noopener noreferrer" style={previewExtLinkStyle}>
              {externalLink}
            </a>
          ) : (
            <div
              className="ql-editor"
              style={previewBodyStyle}
              dangerouslySetInnerHTML={{ __html: descriptions || '<p style="color:#aaa">本文がここに表示されます...</p>' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ── */
const toolbarStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
};
const countStyle: React.CSSProperties = { fontSize: 12, color: colors.textSecondary };
const addBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: `linear-gradient(135deg, #a388c8, ${colors.primary})`,
  color: '#fff', fontSize: 12, fontWeight: 600,
  boxShadow: '0 3px 8px rgba(145,120,189,0.3)',
};
const articleRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
  borderRadius: 12, marginBottom: 8,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '2px 2px 6px rgba(174,164,204,0.1)',
};
const rowThumbStyle: React.CSSProperties = {
  width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
};
const articleTitleRowStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: colors.textPrimary,
  display: 'flex', alignItems: 'center', gap: 4,
};
const articleTitleTextStyle: React.CSSProperties = {
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const draftTagStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
  background: 'rgba(180,180,180,0.2)', color: colors.textSecondary, flexShrink: 0,
};
const articleSubtitleStyle: React.CSSProperties = {
  fontSize: 11, color: colors.textSecondary, marginTop: 1,
};
const articleDateStyle: React.CSSProperties = {
  fontSize: 11, color: colors.textSecondary, marginTop: 2,
};
const articleActionsStyle: React.CSSProperties = {
  display: 'flex', gap: 4, flexShrink: 0,
};
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.5)',
};

/* Editor */
const editorWrapStyle: React.CSSProperties = {
  display: 'flex', gap: 20, alignItems: 'flex-start',
};
const editorFormStyle: React.CSSProperties = {
  flex: '1 1 50%', minWidth: 0,
  display: 'flex', flexDirection: 'column', gap: 14,
  padding: '20px 22px', borderRadius: 16,
  background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.12)',
};
const editorHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const editorHeadingStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: colors.textPrimary, margin: 0,
};
const editorCancelStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 12, color: colors.textSecondary, fontWeight: 500,
};
const fieldLabelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 12, fontWeight: 600, color: colors.textPrimary,
};
const fieldInputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8,
  border: '1px solid rgba(200,190,220,0.3)',
  background: 'rgba(255,255,255,0.75)', fontSize: 13, color: colors.textPrimary, outline: 'none',
};
const uploadAreaStyle: React.CSSProperties = {
  borderRadius: 10, border: '2px dashed rgba(200,190,220,0.4)',
  background: 'rgba(255,255,255,0.5)', cursor: 'pointer',
  overflow: 'hidden', minHeight: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const uploadPreviewStyle: React.CSSProperties = {
  width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block',
};
const uploadPlaceholderStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  padding: 20, fontSize: 11, color: colors.textSecondary,
};
const removeThumbBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 11, color: '#c25a65', fontWeight: 500, padding: '4px 0',
};
const quillWrapStyle: React.CSSProperties = {
  borderRadius: 8, overflow: 'hidden',
  border: '1px solid rgba(200,190,220,0.3)',
  background: 'rgba(255,255,255,0.75)',
};
const checkRowStyle: React.CSSProperties = {
  display: 'flex', gap: 20, flexWrap: 'wrap',
};
const checkLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 500, color: colors.textPrimary, cursor: 'pointer',
};
const saveBtnStyle: React.CSSProperties = {
  padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: `linear-gradient(135deg, #a388c8, ${colors.primary})`,
  color: '#fff', fontSize: 13, fontWeight: 600,
  boxShadow: '0 3px 10px rgba(145,120,189,0.3)',
};

/* Preview panel */
const previewPanelStyle: React.CSSProperties = {
  flex: '1 1 50%', minWidth: 0,
  position: 'sticky', top: 24,
};
const previewLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: colors.textSecondary,
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
};
const previewCardStyle: React.CSSProperties = {
  borderRadius: 16, padding: '22px 24px',
  background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.12), -2px -2px 6px rgba(255,255,255,0.7)',
  maxHeight: '75vh', overflowY: 'auto',
};
const previewThumbStyle: React.CSSProperties = {
  width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 14,
};
const previewMetaStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap',
};
const previewPinBadgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 9px', borderRadius: 10,
  background: 'linear-gradient(135deg, #FFD54A, #FFB33C)',
  color: '#fff', fontSize: 10, fontWeight: 700,
};
const previewDateTextStyle: React.CSSProperties = { fontSize: 11, color: colors.textSecondary };
const previewDraftStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
  background: 'rgba(180,180,180,0.2)', color: colors.textSecondary,
};
const previewLinkTagStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
  background: 'rgba(145,120,189,0.12)', color: colors.primary,
};
const previewHeadingStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px', lineHeight: 1.4,
};
const previewSubtitleStyle: React.CSSProperties = {
  fontSize: 13, color: colors.textSecondary, margin: '0 0 14px', lineHeight: 1.5,
};
const previewExtLinkStyle: React.CSSProperties = {
  fontSize: 13, color: colors.primary, wordBreak: 'break-all',
};
const previewBodyStyle: React.CSSProperties = {
  fontSize: 13, color: colors.textPrimary, lineHeight: 1.8,
  padding: 0, border: 'none',
};
