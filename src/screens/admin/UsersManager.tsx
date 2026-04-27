import React, { useState, useEffect, useCallback } from 'react';
import { IoSearchOutline, IoChevronBack, IoChevronForward } from 'react-icons/io5';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { colors } from '../../theme/colors';

const PAGE_SIZE = 100;

interface UserDoc {
  id: string;
  email: string;
  displayName: string;
  plan: string;
  admin: boolean;
  createdAt: Date | null;
}

export function UsersManager() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [lastDocs, setLastDocs] = useState<(QueryDocumentSnapshot | null)[]>([null]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (cursor: QueryDocumentSnapshot | null) => {
    setLoading(true);
    try {
      const db = getFirestore();
      let q = query(
        collection(db, 'users'),
        orderBy('created_time', 'desc'),
        limit(PAGE_SIZE + 1),
      );
      if (cursor) q = query(collection(db, 'users'), orderBy('created_time', 'desc'), startAfter(cursor), limit(PAGE_SIZE + 1));

      const snap = await getDocs(q);
      const docs: UserDoc[] = snap.docs.slice(0, PAGE_SIZE).map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: data.email ?? '',
          displayName: data.displayName ?? '',
          plan: data.user_type ?? 'free',
          admin: data.admin === true,
          createdAt: (data.created_time ?? data.createdAt)?.toDate?.() ?? null,
        };
      });
      setUsers(docs);
      setHasMore(snap.docs.length > PAGE_SIZE);
      if (snap.docs.length > 0) {
        const lastVisible = snap.docs[Math.min(snap.docs.length - 1, PAGE_SIZE - 1)];
        setLastDocs((prev) => {
          const next = [...prev];
          next[page + 1] = lastVisible;
          return next;
        });
      }
    } catch (err) {
      console.error('User fetch failed', err);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => {
    fetchPage(lastDocs[page] ?? null);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = search.trim()
    ? users.filter((u) =>
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.id.includes(search),
      )
    : users;

  return (
    <div>
      {/* Search */}
      <div style={searchBarStyle}>
        <IoSearchOutline size={16} color={colors.textSecondary} />
        <input
          type="text"
          placeholder="メール・名前・UID で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInputStyle}
        />
      </div>

      {/* Count */}
      <div style={infoRowStyle}>
        <span style={infoTextStyle}>
          {loading ? '読み込み中...' : `${filtered.length} 件表示 (ページ ${page + 1})`}
        </span>
      </div>

      {/* Table */}
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>名前</th>
              <th style={thStyle}>メール</th>
              <th style={thStyle}>プラン</th>
              <th style={thStyle}>Admin</th>
              <th style={thStyle}>登録日</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td style={tdStyle}>{u.displayName || '-'}</td>
                <td style={tdStyle}>{u.email || '-'}</td>
                <td style={tdStyle}>
                  <span style={planTagStyle(u.plan)}>{u.plan}</span>
                </td>
                <td style={tdStyle}>{u.admin ? 'Yes' : ''}</td>
                <td style={tdStyle}>{u.createdAt?.toLocaleDateString('ja-JP') ?? '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: colors.textSecondary }}>
                  該当するユーザーがいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={paginationStyle}>
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
          style={pageBtnStyle}
        >
          <IoChevronBack size={14} /> 前へ
        </button>
        <span style={pageNumStyle}>ページ {page + 1}</span>
        <button
          type="button"
          disabled={!hasMore}
          onClick={() => setPage(page + 1)}
          style={pageBtnStyle}
        >
          次へ <IoChevronForward size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Styles ── */
const searchBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
  borderRadius: 10, marginBottom: 14,
  background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.8)',
  boxShadow: 'inset 1px 1px 3px rgba(174,164,204,0.1)',
};
const searchInputStyle: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', background: 'transparent',
  fontSize: 13, color: colors.textPrimary,
};
const infoRowStyle: React.CSSProperties = {
  marginBottom: 10,
};
const infoTextStyle: React.CSSProperties = { fontSize: 12, color: colors.textSecondary };

const tableWrapStyle: React.CSSProperties = {
  borderRadius: 12, overflow: 'hidden',
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '2px 2px 8px rgba(174,164,204,0.1)',
  overflowX: 'auto',
};
const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
};
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontWeight: 600,
  color: colors.textSecondary, borderBottom: '1px solid rgba(200,190,220,0.2)',
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 14px', borderBottom: '1px solid rgba(200,190,220,0.1)',
  color: colors.textPrimary, whiteSpace: 'nowrap',
};
const planTagStyle = (plan: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
  background: plan === 'premium'
    ? 'rgba(255,179,60,0.15)'
    : plan === 'free'
      ? 'rgba(180,180,180,0.15)'
      : 'rgba(145,120,189,0.12)',
  color: plan === 'premium'
    ? '#c08920'
    : plan === 'free'
      ? '#888'
      : colors.primary,
});

const paginationStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16,
  padding: '16px 0',
};
const pageBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(200,190,220,0.3)',
  background: 'rgba(255,255,255,0.6)', cursor: 'pointer',
  fontSize: 12, fontWeight: 500, color: colors.textPrimary,
};
const pageNumStyle: React.CSSProperties = {
  fontSize: 12, color: colors.textSecondary, fontWeight: 500,
};
