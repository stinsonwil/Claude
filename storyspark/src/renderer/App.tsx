import React, { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { StoryViewer } from './pages/StoryViewer'
import { Favorites } from './pages/Favorites'
import { Settings } from './pages/Settings'
import { storageService } from './services/storageService'

export const App: React.FC = () => {
  const [initialTheme, setInitialTheme] = useState<'light' | 'dark'>('dark')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    storageService.getSettings().then(s => {
      setInitialTheme(s.theme || 'dark')
      setReady(true)
    }).catch(() => setReady(true))
  }, [])

  if (!ready) return null

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="/story" element={<StoryViewer />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App
