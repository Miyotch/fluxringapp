import { useState, useEffect } from 'react';
import { IoPin, IoOpenOutline, IoClose } from 'react-icons/io5';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';

interface ArticleItem {
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

export function ArticlesScreen() {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ArticleItem | null>(null);

  useEffect(() => {
    const q = query(collection(getFirestore(), 'article'), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const docs: ArticleItem[] = snap.docs.map((d) => {
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
        const visible = docs
          .filter((a) => a.published)
          .sort((a, b) => {
            if (a.stable !== b.stable) return a.stable ? -1 : 1;
            return b.date.getTime() - a.date.getTime();
          });
        setArticles(visible);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  const handleClick = (article: ArticleItem) => {
    if (article.external_link) {
      window.open(article.external_link, '_blank', 'noopener,noreferrer');
    } else {
      setDetail(article);
    }
  };

  return (
    <GradientBackground>
      <div style={pageStyle}>
        <h1 style={headingStyle}>Knowledge and Frequency</h1>
        <p style={subStyle}>サウンドと集中力に関する記事</p>

        {loading && <p style={loadingStyle}>読み込み中...</p>}

        <div style={articleListStyle}>
          {articles.map((article) => (
            <div
              key={article.id}
              style={articleCardStyle}
              onClick={() => handleClick(article)}
            >
              {article.thumbnail && (
                <img src={article.thumbnail} alt="" style={cardThumbStyle} />
              )}
              <div style={articleContentStyle}>
                <div style={articleHeaderStyle}>
                  {article.stable && (
                    <span style={pinBadgeStyle}><IoPin size={11} color="#fff" /> 固定</span>
                  )}
                  <span style={articleDateStyle}>
                    {article.date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  {article.external_link && <IoOpenOutline size={13} color={colors.textSecondary} />}
                </div>
                <h3 style={articleTitleStyle}>{article.title}</h3>
                {article.subtitle && <p style={articleSubtitleStyle}>{article.subtitle}</p>}
              </div>
            </div>
          ))}
        </div>

        {!loading && articles.length === 0 && (
          <p style={emptyStyle}>まだ記事がありません。</p>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div style={modalOverlayStyle} onClick={() => setDetail(null)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setDetail(null)} style={modalCloseBtnStyle}>
              <IoClose size={20} color={colors.textSecondary} />
            </button>

            {detail.thumbnail && (
              <img src={detail.thumbnail} alt="" style={modalThumbStyle} />
            )}

            <div style={modalDateStyle}>
              {detail.date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <h2 style={modalTitleStyle}>{detail.title}</h2>
            {detail.subtitle && <p style={modalSubtitleStyle}>{detail.subtitle}</p>}

            <div
              className="ql-editor"
              style={modalBodyStyle}
              dangerouslySetInnerHTML={{ __html: detail.descriptions }}
            />
          </div>
        </div>
      )}
    </GradientBackground>
  );
}

/* ── List styles ── */
const pageStyle: React.CSSProperties = { padding: '32px 28px', height: '100%', overflowY: 'auto', maxWidth: 900, margin: '0 auto', width: '100%' };
const headingStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' };
const subStyle: React.CSSProperties = { fontSize: 13, color: colors.textSecondary, margin: '0 0 24px' };
const loadingStyle: React.CSSProperties = { textAlign: 'center', color: colors.textSecondary, padding: 32, fontSize: 13 };
const emptyStyle: React.CSSProperties = { textAlign: 'center', color: colors.textSecondary, padding: 40, fontSize: 13 };
const articleListStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };
const articleCardStyle: React.CSSProperties = {
  display: 'flex', gap: 14, padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.15), -2px -2px 6px rgba(255,255,255,0.8)',
  minHeight: 100, alignItems: 'center', transition: 'transform 0.15s',
};
const cardThumbStyle: React.CSSProperties = { width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flexShrink: 0 };
const articleContentStyle: React.CSSProperties = { flex: 1, minWidth: 0 };
const articleHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 };
const pinBadgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px', borderRadius: 10,
  background: 'linear-gradient(135deg, #FFD54A, #FFB33C)', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0,
};
const articleDateStyle: React.CSSProperties = { fontSize: 11, color: colors.textMuted };
const articleTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, color: colors.textPrimary, margin: '0 0 2px', lineHeight: 1.4 };
const articleSubtitleStyle: React.CSSProperties = { fontSize: 12, color: colors.textSecondary, margin: 0, lineHeight: 1.4 };

/* ── Detail modal styles ── */
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 500,
  background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'searchFadeIn 0.3s ease-out',
};
const modalCardStyle: React.CSSProperties = {
  position: 'relative',
  width: '92%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto',
  borderRadius: 22, padding: '28px 28px 24px',
  background: 'rgba(240, 237, 248, 0.96)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '10px 10px 40px rgba(174,164,204,0.25), -4px -4px 16px rgba(255,255,255,0.8)',
};
const modalCloseBtnStyle: React.CSSProperties = {
  position: 'absolute', top: 16, right: 16,
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '50%', width: 34, height: 34, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '2px 2px 6px rgba(174,164,204,0.15)',
};
const modalThumbStyle: React.CSSProperties = {
  width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 14, marginBottom: 18,
};
const modalDateStyle: React.CSSProperties = {
  fontSize: 12, color: colors.textSecondary, marginBottom: 6,
};
const modalTitleStyle: React.CSSProperties = {
  fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px', lineHeight: 1.4,
};
const modalSubtitleStyle: React.CSSProperties = {
  fontSize: 14, color: colors.textSecondary, margin: '0 0 18px', lineHeight: 1.5,
};
const modalBodyStyle: React.CSSProperties = {
  fontSize: 14, color: colors.textPrimary, lineHeight: 1.9,
  padding: 0, border: 'none',
};
