import { createContext, useContext } from 'react';
import type { DataApi } from './api';

export const DataContext = createContext<DataApi | null>(null);

export function useData(): DataApi {
  const api = useContext(DataContext);
  if (!api) throw new Error('useData must be used inside <DataContext.Provider>');
  return api;
}
