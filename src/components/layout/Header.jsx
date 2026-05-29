import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Roundel } from './icons';
import LangToggle from './LangToggle';
import './Header.css';

/* Mobile-only top bar. On desktop the Sidebar owns the brand. */
export default function Header() {
  const { t } = useTranslation();

  return (
    <header className="app-header">
      <NavLink to="/" end className="header-logo" title={t('nav.dashboard')}>
        <Roundel size={30} />
        <span className="logo-text">
          <span className="logo-bimmer">Bimmer</span><span className="logo-care">Care</span>
        </span>
      </NavLink>
      <LangToggle />
    </header>
  );
}
