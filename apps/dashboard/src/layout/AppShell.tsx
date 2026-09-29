import { useEffect, useState } from 'react';
import { CommandPalette } from '../components/CommandPalette';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TopBarSlot } from './topBarSlot';
import styles from './AppShell.module.css';

export function AppShell() {
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  // Below 1024 px the sidebar is a drawer; it closes whenever the page changes.
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const [openedAt, setOpenedAt] = useState(pathname);
  if (navOpen && openedAt !== pathname) setNavOpen(false);

  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && (
        <div className={styles.backdrop} aria-hidden="true" onClick={() => setNavOpen(false)} />
      )}
      <div className={styles.main}>
        <TopBar
          actionsRef={setActions}
          navOpen={navOpen}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNav={() => {
            setOpenedAt(pathname);
            setNavOpen(true);
          }}
        />
        <TopBarSlot.Provider value={actions}>
          <main id="main-content" className={styles.content} tabIndex={-1}>
            <Outlet />
          </main>
        </TopBarSlot.Provider>
      </div>
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
