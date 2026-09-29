import { createContext } from 'react';

/** The top bar element page actions are portalled into. */
export const TopBarSlot = createContext<HTMLElement | null>(null);
