import React, { useState, useEffect, useCallback } from 'react';
import {
  IoAdd,
  IoCreateOutline,
  IoTrashOutline,
  IoPin,
  IoPinOutline,
  IoEye,
  IoEyeOff,
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
import { colors } from '../../theme/colors';

interface ArticleDoc {
  id: string;
  title: string;
  descriptions: string;
  date: Date;
  published: boolean;
  stable: boolean;
}

const COLLECTION = 'article';

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
          descriptions: data.descriptions ?? '',
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(),
          published: data.published === true,
          stable: data.stable === true,
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={articleTitleStyle}>
              {a.stable && <IoPin size={13} color="#FFB33C" style={{ marginRight: 4, flexShrink: 0 }} />}
              {a.title}
              {!a.published && <span style={draftTagStyle}>下書き</span>}
            </div>
            <div style={articleDateStyle}>
              {a.date.toLocaleDateString('ja-JP')}
            </div>
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
  const [descriptions, setDescriptions] = useState(article?.descriptions ?? '');
  const [date, setDate] = useState(
    article ? article.date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [published, setPublished] = useState(article?.published ?? false);
  const [stable, setStable] = useState(article?.stable ?? false);
  const [busy, setBusy] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const db = getFirestore();
    const payload = {
      title: title.trim(),
      descriptions,
      date: Timestamp.fromDate(new Date(date + 'T00:00:00')),
      published,
      stable,
    };
    try {
      if (article) {
        await updateDoc(doc(db, COLLECTION, article.id), payload);
      } else {
        await addDoc(collection(db, COLLECTION), payload);
      }
      onDone();
    } catch (err) {
      console.error('Save failed', err);
      alert('保存に失敗しました。');
    } finally { setBusy(false); }
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
          公開日 (date)
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldInputStyle} />
        </label>

        <label style={fieldLabelStyle}>
          本文 (descriptions)
          <textarea
            value={descriptions}
            onChange={(e) => setDescriptions(e.target.value)}
            rows={14}
            style={textareaStyle}
            placeholder="記事の本文を入力してください"
          />
        </label>

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

        <button type="submit" disabled={busy} style={saveBtnStyle}>
          {busy ? '保存中...' : article ? '更新する' : '投稿する'}
        </button>
      </form>

      {/* Right: live preview */}
      <div style={previewPanelStyle}>
        <div style={previewLabelStyle}>プレビュー</div>
        <div style={previewCardStyle}>
          <div style={previewMetaStyle}>
            {stable && (
              <span style={previewPinBadgeStyle}>
                <IoPin size={11} color="#fff" /> 固定
              </span>
            )}
            <span style={previewDateTextStyle}>{date}</span>
            {!published && <span style={previewDraftStyle}>下書き</span>}
          </div>
          <h2 style={previewHeadingStyle}>{title || '（タイトル未入力）'}</h2>
          <div style={previewBodyStyle}>
            {descriptions || '本文がここに表示されます...'}
          </div>
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
const articleTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: colors.textPrimary,
  display: 'flex', alignItems: 'center', gap: 4,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const draftTagStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
  background: 'rgba(180,180,180,0.2)', color: colors.textSecondary, marginLeft: 4,
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
const textareaStyle: React.CSSProperties = {
  ...fieldInputStyle,
  resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.7,
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
  textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: 8,
};
const previewCardStyle: React.CSSProperties = {
  borderRadius: 16, padding: '22px 24px',
  background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.12), -2px -2px 6px rgba(255,255,255,0.7)',
  maxHeight: '75vh', overflowY: 'auto',
};
const previewMetaStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
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
const previewHeadingStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: colors.textPrimary, margin: '0 0 14px',
  lineHeight: 1.4,
};
const previewBodyStyle: React.CSSProperties = {
  fontSize: 13, color: colors.textPrimary, lineHeight: 1.8,
  wordBreak: 'break-word', whiteSpace: 'pre-wrap',
};
