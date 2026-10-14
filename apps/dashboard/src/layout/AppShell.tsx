import { useEffect, useState } from 'react';
import { CommandPalette } from '../components/CommandPalette';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TopBarSlot } from './topBarSlot';
import styles from './AppShell.module.css';

const SIDEBAR_KEY = 'splitcraft_sidebar';

export function AppShell() {
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  // Below 1024 px the sidebar is a drawer; it closes whenever the page changes.
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const [openedAt, setOpenedAt] = useState(pathname);
  if (navOpen && openedAt !== pathname) setNavOpen(false);

  // From 1024 px the sidebar stays in place and can be hidden for more room (remembered).
  const [hidden, setHiddenState] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'hidden';
    } catch {
      return false;
    }
  });
  const setHidden = (next: boolean) => {
    setHiddenState(next);
    // Keep focus on the control that brings it back (or hides it again).
    requestAnimationFrame(() =>
      document.getElementById(next ? 'show-sidebar' : 'hide-sidebar')?.focus(),
    );
    try {
      if (next) localStorage.setItem(SIDEBAR_KEY, 'hidden');
      else localStorage.removeItem(SIDEBAR_KEY);
    } catch {
      // Storage blocked: lasts until reload.
    }
  };
  const wide = () => typeof matchMedia !== 'function' || matchMedia('(min-width: 1024px)').matches;

  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
      // Cmd/Ctrl+\ hides or shows the sidebar.
      if ((e.metaKey || e.ctrlKey) && e.key === '\\' && wide()) {
        e.preventDefault();
        setHiddenState((h) => {
          try {
            if (h) localStorage.removeItem(SIDEBAR_KEY);
            else localStorage.setItem(SIDEBAR_KEY, 'hidden');
          } catch {
            // Storage blocked.
          }
          return !h;
        });
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
      <Sidebar
        open={navOpen}
        hidden={hidden}
        onClose={() => setNavOpen(false)}
        onHide={() => setHidden(true)}
      />
      {navOpen && (
        <div className={styles.backdrop} aria-hidden="true" onClick={() => setNavOpen(false)} />
      )}
      <div className={styles.main}>
        <TopBar
          actionsRef={setActions}
          navOpen={navOpen}
          sidebarHidden={hidden}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNav={() => {
            if (wide()) {
              setHidden(false);
              return;
            }
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
