import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Settings, Story } from '../types'

interface AppContextType {
  settings: Settings
  updateSettings: (partial: Partial<Settings>) => Promise<void>
  settingsLoaded: boolean
  currentStory: Story | null
  setCurrentStory: (story: Story | null) => void
}

const defaultSettings: Settings = {
  anthropicApiKey: '',
  openaiApiKey: '',
  defaultModel: 'claude-3-haiku-20240307',
  defaultLength: 'medium',
  autoImageGen: false,
  theme: 'dark',
  ttsRate: 1.0,
  ttsVoice: '',
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [currentStory, setCurrentStory] = useState<Story | null>(null)

  useEffect(() => {
    window.electronAPI.getSettings().then(s => {
      setSettings(s)
      setSettingsLoaded(true)
      // Apply theme
      if (s.theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }).catch(() => {
      setSettingsLoaded(true)
    })
  }, [])

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    const next = { ...settings, ...partial }
    setSettings(next)
    await window.electronAPI.saveSettings(partial)
    if (partial.theme) {
      if (partial.theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [settings])

  return (
    <AppContext.Provider value={{ settings, updateSettings, settingsLoaded, currentStory, setCurrentStory }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
