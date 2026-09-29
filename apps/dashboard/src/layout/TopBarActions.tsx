import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TopBarSlot } from './topBarSlot';

/** Render page actions (e.g. "New project") into the top bar's right side. */
export function TopBarActions({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarSlot);
  return slot ? createPortal(children, slot) : null;
}
