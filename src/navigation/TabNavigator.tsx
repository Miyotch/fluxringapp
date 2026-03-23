import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  IoHome,
  IoHomeOutline,
  IoSearch,
  IoSearchOutline,
  IoList,
  IoListOutline,
  IoDocumentText,
  IoDocumentTextOutline,
  IoNotifications,
  IoNotificationsOutline,
  IoSettings,
  IoSettingsOutline,
} from 'react-icons/io5';
import { colors } from '../theme/colors';

const TAB_CONFIG = [
  { path: '/', label: 'ホーム', icon: IoHome, iconOutline: IoHomeOutline },
  { path: '/search', label: '検索', icon: IoSearch, iconOutline: IoSearchOutline },
  { path: '/playlist', label: 'プレイリスト', icon: IoList, iconOutline: IoListOutline },
  { path: '/articles', label: '記事を読む', icon: IoDocumentText, iconOutline: IoDocumentTextOutline },
  { path: '/notifications', label: 'お知らせ', icon: IoNotifications, iconOutline: IoNotificationsOutline },
  { path: '/settings', label: '設定', icon: IoSettings, iconOutline: IoSettingsOutline },
] as const;

export function TabNavigator() {
  return (
    <div style={layoutStyle}>
      <div style={contentStyle}>
        <Outlet />
      </div>
      <nav style={tabBarStyle}>
        {TAB_CONFIG.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/'}
            style={({ isActive }) => ({
              ...tabItemStyle,
              color: isActive ? colors.tabActive : colors.tabInactive,
            })}
          >
            {({ isActive }) => {
              const Icon = isActive ? tab.icon : tab.iconOutline;
              return (
                <>
                  <Icon size={22} />
                  <span style={tabLabelStyle}>{tab.label}</span>
                </>
              );
            }}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-around',
  alignItems: 'center',
  backgroundColor: colors.tabBarBackground,
  borderTop: `1px solid ${colors.tabBarBorder}`,
  padding: '4px 0',
  height: 56,
};

const tabItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  textDecoration: 'none',
  flex: 1,
};

const tabLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
};
