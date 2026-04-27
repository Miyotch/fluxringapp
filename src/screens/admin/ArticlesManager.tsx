import React, { useState, useEffect, useCallback } from 'react';
import {
  IoAdd,
  IoCreateOutline,
  IoTrashOutline,
  IoPin,
  IoPinOutline,
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
  Timestamp,
} from 'firebase/firestore';
import { colors } from '../../theme/colors';

interface ArticleDoc {
  id: string;
  title: string;
  body: string;
  thumbnailUrl: string;
  publishedAt: Date;
  pinned: boolean;
}

export function ArticlesManager() {
  const [articles, setArticles] = useState<ArticleDoc[]>([]);
  const [editing, setEditing] = useState<ArticleDoc | 'new' | null>(null);

  useEffect(() => {
    const q = query(collection(getFirestore(), 'articles'), orderBy('publishedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      const docs: ArticleDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title ?? '',
          body: data.body ?? '',
          thumbnailUrl: data.thumbnailUrl ?? data.imageUrl ?? '',
          publishedAt: data.publishedAt instanceof Timestamp ? data.publishedAt.toDate() : new Date(),
          pinned: data.pinned === true,
        };
      });
      docs.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      });
      setArticles(docs);
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('この記事を削除しますか？')) return;
    await deleteDoc(doc(getFirestore(), 'articles', id));
  }, []);

  const handleTogglePin = useCallback(async (article: ArticleDoc) => {
    await updateDoc(doc(getFirestore(), 'articles', article.id), { pinned: !article.pinned });
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
        <div key={a.id} style={articleRowStyle}>
          {a.thumbnailUrl && (
            <img src={a.thumbnailUrl} alt="" style={thumbStyle} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={articleTitleStyle}>
              {a.pinned && <IoPin size={13} color="#FFB33C" style={{ marginRight: 4, flexShrink: 0 }} />}
              {a.title}
            </div>
            <div style={articleDateStyle}>
              {a.publishedAt.toLocaleDateString('ja-JP')}
            </div>
          </div>
          <div style={articleActionsStyle}>
            <button type="button" onClick={() => handleTogglePin(a)} style={iconBtn} title={a.pinned ? '固定解除' : '上に固定'}>
              {a.pinned ? <IoPin size={16} color="#FFB33C" /> : <IoPinOutline size={16} color={colors.textSecondary} />}
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

/* ── Article Editor (rich text-ish) ── */
function ArticleEditor({
  article,
  onDone,
}: {
  article: ArticleDoc | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [body, setBody] = useState(article?.body ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(article?.thumbnailUrl ?? '');
  const [date, setDate] = useState(
    article ? article.publishedAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [pinned, setPinned] = useState(article?.pinned ?? false);
  const [busy, setBusy] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const db = getFirestore();
    const payload = {
      title: title.trim(),
      body,
      thumbnailUrl: thumbnailUrl.trim(),
      publishedAt: Timestamp.fromDate(new Date(date + 'T00:00:00')),
      pinned,
      updatedAt: serverTimestamp(),
    };
    try {
      if (article) {
        await updateDoc(doc(db, 'articles', article.id), payload);
      } else {
        await addDoc(collection(db, 'articles'), { ...payload, createdAt: serverTimestamp() });
      }
      onDone();
    } catch (err) {
      console.error('Save failed', err);
      alert('保存に失敗しました。');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={handleSave} style={editorFormStyle}>
      <div style={editorHeaderStyle}>
        <h3 style={editorTitleStyle}>{article ? '記事を編集' : '新規記事'}</h3>
        <button type="button" onClick={onDone} style={editorCancelStyle}>キャンセル</button>
      </div>

      <label style={fieldLabelStyle}>
        タイトル
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={fieldInputStyle} placeholder="記事タイトル" />
      </label>

      <label style={fieldLabelStyle}>
        公開日
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldInputStyle} />
      </label>

      <label style={fieldLabelStyle}>
        サムネイルURL
        <input type="url" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} style={fieldInputStyle} placeholder="https://..." />
      </label>
      {thumbnailUrl && <img src={thumbnailUrl} alt="preview" style={thumbPreviewStyle} />}

      <label style={fieldLabelStyle}>
        本文
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          style={textareaStyle}
          placeholder="Markdown / HTMLで記述できます"
        />
      </label>

      <label style={checkLabelStyle}>
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        <IoPin size={14} color={pinned ? '#FFB33C' : colors.textSecondary} />
        上部に固定する
      </label>

      <button type="submit" disabled={busy} style={saveBtnStyle}>
        {busy ? '保存中...' : article ? '更新する' : '投稿する'}
      </button>
    </form>
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
const thumbStyle: React.CSSProperties = {
  width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
};
const articleTitleStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, color: colors.textPrimary,
  display: 'flex', alignItems: 'center',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
const editorFormStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 14,
  padding: '20px 22px', borderRadius: 16,
  background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.12)',
};
const editorHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const editorTitleStyle: React.CSSProperties = {
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
const thumbPreviewStyle: React.CSSProperties = {
  width: 120, height: 80, objectFit: 'cover', borderRadius: 8,
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
