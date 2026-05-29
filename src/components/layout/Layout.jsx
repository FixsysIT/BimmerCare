import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Navigation from './Navigation';
import './Layout.css';

export default function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <Header />
      <main className="app-main">
        <div className="app-content">
          <Outlet />
        </div>
      </main>
      <Navigation />
    </div>
  );
}
