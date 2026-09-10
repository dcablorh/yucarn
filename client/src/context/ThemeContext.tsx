import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppKitTheme } from '@reown/appkit/react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setThemeMode } = useAppKitTheme();
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('unipay_theme') as Theme;
    return saved || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      setThemeMode('dark');
    } else {
      root.classList.remove('dark');
      setThemeMode('light');
    }
    localStorage.setItem('unipay_theme', theme);
  }, [theme, setThemeMode]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
