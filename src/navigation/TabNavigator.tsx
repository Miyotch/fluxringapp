import { NavLink, Outlet } from 'react-router-dom';
import {
  IoHome,
  IoHomeOutline,
  IoSearch,
  IoSearchOutline,
  IoClipboard,
  IoClipboardOutline,
  IoDocumentText,
  IoDocumentTextOutline,
  IoNotifications,
  IoNotificationsOutline,
  IoSettings,
  IoSettingsOutline,
} from 'react-icons/io5';
import styles from './TabNavigator.module.css';

const TAB_CONFIG = [
  { path: '/', label: 'ホーム', icon: IoHome, iconOutline: IoHomeOutline },
  { path: '/search', label: '検索', icon: IoSearch, iconOutline: IoSearchOutline },
  { path: '/playlist', label: 'プレイリスト', icon: IoClipboard, iconOutline: IoClipboardOutline },
  { path: '/articles', label: '記事を読む', icon: IoDocumentText, iconOutline: IoDocumentTextOutline },
  { path: '/notifications', label: 'お知らせ', icon: IoNotifications, iconOutline: IoNotificationsOutline },
  { path: '/settings', label: '設定', icon: IoSettings, iconOutline: IoSettingsOutline },
] as const;

export function TabNavigator() {
  return (
    <div className={styles.layout}>
      <div className={styles.content}>
        <Outlet />
      </div>
      <div className={styles.tabBarOuter}>
        <nav className={styles.tabBar}>
          {TAB_CONFIG.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/'}
              className={({ isActive }) =>
                `${styles.tabItem} ${isActive ? styles.tabItemActive : ''}`
              }
            >
              {({ isActive }) => {
                const Icon = isActive ? tab.icon : tab.iconOutline;
                return (
                  <>
                    <Icon size={22} />
                    <span className={styles.tabLabel}>{tab.label}</span>
                  </>
                );
              }}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
