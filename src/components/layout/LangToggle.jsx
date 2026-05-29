import { useTranslation } from 'react-i18next';
import { Globe } from './icons';

export default function LangToggle({ className = '' }) {
  const { i18n } = useTranslation();

  const toggle = () => {
    const next = i18n.language === 'en' ? 'nl' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('bimmercare_language', next);
  };

  return (
    <button className={`lang-toggle ${className}`} onClick={toggle} title="Toggle language">
      <Globe />
      <span>{i18n.language === 'en' ? 'NL' : 'EN'}</span>
    </button>
  );
}
