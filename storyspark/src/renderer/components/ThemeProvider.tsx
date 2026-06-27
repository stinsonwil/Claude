import React, { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
})

export const ThemeProvider: React.FC<{ children: React.ReactNode; initialTheme?: Theme }> = ({
  children,
  initialTheme = 'dark',
}) => {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    setThemeState(initialTheme)
  }, [initialTheme])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => setThemeState(newTheme)
  const toggleTheme = () => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useThemeContext = () => useContext(ThemeContext)
