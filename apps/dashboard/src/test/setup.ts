import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Monaco loads from a CDN in the browser; tests use a plain textarea with the same props.
vi.mock('@monaco-editor/react', async () => {
  const { createElement } = await import('react');
  return {
    default: (props: {
      value: string;
      onChange(v: string): void;
      options?: { ariaLabel?: string; readOnly?: boolean };
    }) =>
      createElement('textarea', {
        'aria-label': props.options?.ariaLabel,
        value: props.value,
        readOnly: props.options?.readOnly,
        onChange: (e: { target: { value: string } }) => props.onChange(e.target.value),
      }),
  };
});
