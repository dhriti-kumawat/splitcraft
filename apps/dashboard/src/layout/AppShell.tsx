import { useState } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TopBarSlot } from './topBarSlot';
import styles from './AppShell.module.css';

export function AppShell() {
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skip}>
        Skip to content
      </a>
      <Sidebar />
      <div className={styles.main}>
        <TopBar actionsRef={setActions} />
        <TopBarSlot.Provider value={actions}>
          <main id="main-content" className={styles.content} tabIndex={-1}>
            <Outlet />
          </main>
        </TopBarSlot.Provider>
      </div>
    </div>
  );
}
