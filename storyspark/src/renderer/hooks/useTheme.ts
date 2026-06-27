import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

export function useTheme(initialTheme: Theme = 'dark') {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  return { theme, setTheme, toggleTheme }
}
