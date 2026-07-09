import { Wrench, Wallet, Package, Settings, PiggyBank, Hammer } from 'lucide-react';

/* Crisp thin-stroke icons (lucide-react). Roundel brand mark stays custom.
   Dashboard is reached via the logo; Settings lives in the sidebar footer. */
const iconProps = { size: 22, strokeWidth: 1.9, absoluteStrokeWidth: true };
const wrap = (Icon) => (p) => <Icon {...iconProps} {...p} />;

export const navItems = [
  { path: '/maintenance', key: 'maintenance', Icon: wrap(Wrench) },
  { path: '/budget', key: 'budget', Icon: wrap(PiggyBank) },
  { path: '/costs', key: 'costs', Icon: wrap(Wallet) },
  { path: '/parts', key: 'parts', Icon: wrap(Package) },
  { path: '/projects', key: 'projects', Icon: wrap(Hammer) },
];

export const settingsItem = { path: '/settings', key: 'settings', Icon: wrap(Settings) };
