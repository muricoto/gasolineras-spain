import { useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from './pages/HomePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
});

function getInitialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('fuel-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* sin localStorage */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('fuel-theme', theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <HomePage theme={theme} onToggleTheme={toggleTheme} />
    </QueryClientProvider>
  );
}
