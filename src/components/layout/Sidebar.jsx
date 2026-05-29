import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Roundel } from './icons';
import { navItems, settingsItem } from './navConfig';
import LangToggle from './LangToggle';
import './Sidebar.css';

export default function Sidebar() {
  const { t } = useTranslation();
  const { Icon: SettingsIcon } = settingsItem;

  return (
    <aside className="sidebar">
      <NavLink to="/" end className="sidebar-brand" title={t('nav.dashboard')}>
        <Roundel size={38} />
        <div className="sidebar-wordmark">
          <span className="logo-text">
            <span className="logo-bimmer">Bimmer</span><span className="logo-care">Care</span>
          </span>
          <span className="sidebar-sub">{t('app.tagline')}</span>
        </div>
      </NavLink>

      <nav className="sidebar-nav">
        {navItems.map(({ path, key, Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `side-link ${isActive ? 'side-active' : ''}`}
          >
            <span className="side-icon"><Icon /></span>
            <span className="side-label">{t(`nav.${key}`)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink
          to={settingsItem.path}
          className={({ isActive }) => `footer-icon-btn ${isActive ? 'footer-active' : ''}`}
          title={t(`nav.${settingsItem.key}`)}
          aria-label={t(`nav.${settingsItem.key}`)}
        >
          <SettingsIcon />
        </NavLink>
        <LangToggle />
      </div>
    </aside>
  );
}
