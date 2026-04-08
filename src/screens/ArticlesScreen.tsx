import React from 'react';
import { IoTimeOutline } from 'react-icons/io5';
import { GradientBackground } from '../components/ui/GradientBackground';
import { colors } from '../theme/colors';

const sampleArticles = [
  {
    id: '1',
    title: 'ノイズキャンセリングの科学',
    summary: '音の波形を理解して、最適なサウンドマスキングを実現する方法を紹介します。',
    date: '2025.03.15',
    readTime: '5分',
    imageColor: '#c8bde5',
  },
  {
    id: '2',
    title: '集中力を高める環境音の選び方',
    summary: 'リモートワーク時代に必要な、生産性を向上させるサウンドデザインのヒント。',
    date: '2025.03.10',
    readTime: '4分',
    imageColor: '#b8d4c8',
  },
  {
    id: '3',
    title: 'Flux Ring の使い方ガイド',
    summary: 'ダイヤル操作から曲の選択まで、Flux Ring を最大限に活用するためのガイド。',
    date: '2025.03.05',
    readTime: '3分',
    imageColor: '#d4c0a8',
  },
  {
    id: '4',
    title: '睡眠の質を改善するサウンド',
    summary: '科学的根拠に基づいた、深い眠りを促進するサウンドセラピーの紹介。',
    date: '2025.02.28',
    readTime: '6分',
    imageColor: '#a8b8d4',
  },
];

export function ArticlesScreen() {
  return (
    <GradientBackground>
      <div style={pageStyle}>
        <h1 style={headingStyle}>Knowledge and Frequency</h1>
        <p style={subStyle}>サウンドと集中力に関する記事</p>

        <div style={articleListStyle}>
          {sampleArticles.map((article) => (
            <div key={article.id} style={articleCardStyle}>
              <div style={{ ...articleImageStyle, background: `linear-gradient(135deg, ${article.imageColor}, ${article.imageColor}dd)` }} />
              <div style={articleContentStyle}>
                <h3 style={articleTitleStyle}>{article.title}</h3>
                <p style={articleSummaryStyle}>{article.summary}</p>
                <div style={articleMetaStyle}>
                  <span style={articleDateStyle}>{article.date}</span>
                  <span style={articleReadStyle}>
                    <IoTimeOutline size={12} /> {article.readTime}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GradientBackground>
  );
}

const pageStyle: React.CSSProperties = {
  padding: '32px 28px', height: '100%', overflowY: 'auto',
  maxWidth: 900, margin: '0 auto', width: '100%',
};
const headingStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' };
const subStyle: React.CSSProperties = { fontSize: 13, color: colors.textSecondary, margin: '0 0 24px' };
const articleListStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };
const articleCardStyle: React.CSSProperties = {
  display: 'flex', gap: 14, padding: 14, borderRadius: 16, cursor: 'pointer',
  background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '3px 3px 10px rgba(174,164,204,0.15), -2px -2px 6px rgba(255,255,255,0.8)',
};
const articleImageStyle: React.CSSProperties = {
  width: 90, height: 90, borderRadius: 12, flexShrink: 0,
};
const articleContentStyle: React.CSSProperties = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const articleTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: colors.textPrimary, margin: '0 0 4px', lineHeight: 1.4 };
const articleSummaryStyle: React.CSSProperties = {
  fontSize: 12, color: colors.textSecondary, margin: 0, lineHeight: 1.5,
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
};
const articleMetaStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 };
const articleDateStyle: React.CSSProperties = { fontSize: 11, color: colors.textMuted };
const articleReadStyle: React.CSSProperties = { fontSize: 11, color: colors.textMuted, display: 'flex', alignItems: 'center', gap: 3 };
