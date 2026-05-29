import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { navItems, settingsItem } from './navConfig';
import './Navigation.css';

/* Mobile-only bottom tab bar (desktop uses the Sidebar).
   Dashboard is reached via the header logo. */
const mobileItems = [...navItems, settingsItem];

export default function Navigation() {
  const { t } = useTranslation();

  return (
    <nav className="app-nav">
      {mobileItems.map(({ path, key, Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
        >
          <span className="nav-icon"><Icon /></span>
          <span className="nav-label">{t(`nav.${key}`)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
