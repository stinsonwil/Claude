import React, { useState, useEffect, useContext, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon, Eye, EyeOff, Save } from 'lucide-react'
import { ToastContext } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useThemeContext } from '../components/ThemeProvider'
import { storageService } from '../services/storageService'
import { loadVoices } from '../services/ttsService'
import { Settings as SettingsType } from '../types'

const models = [
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast)' },
  { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet (Balanced)' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Best)' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
]

export const Settings: React.FC = () => {
  const { addToast } = useContext(ToastContext)
  const { theme, setTheme } = useThemeContext()
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    Promise.all([
      storageService.getSettings(),
      loadVoices(),
    ]).then(([s, v]) => {
      setSettings(s)
      setVoices(v)
    }).catch(() => {
      addToast('Failed to load settings', 'error')
    }).finally(() => setIsLoading(false))
  }, [addToast])

  const update = useCallback(<K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
    if (key === 'theme') {
      setTheme(value as 'light' | 'dark')
    }
  }, [setTheme])

  const handleSave = async () => {
    if (!settings) return
    setIsSaving(true)
    try {
      await storageService.saveSettings(settings)
      addToast('Settings saved!', 'success')
    } catch {
      addToast('Failed to save settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner message="Loading settings..." />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon size={28} className="text-primary-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>

        <div className="flex flex-col gap-6">
          {/* API Keys */}
          <Section title="API Keys" description="Required for story and image generation">
            <Field label="Anthropic API Key" hint="Required for story generation">
              <div className="relative">
                <input
                  type={showAnthropicKey ? 'text' : 'password'}
                  value={settings.anthropicApiKey}
                  onChange={e => update('anthropicApiKey', e.target.value)}
                  placeholder="sk-ant-..."
                  className="input pr-10"
                />
                <button
                  onClick={() => setShowAnthropicKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showAnthropicKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            <Field label="OpenAI API Key" hint="Optional — required for DALL-E image generation">
              <div className="relative">
                <input
                  type={showOpenAIKey ? 'text' : 'password'}
                  value={settings.openaiApiKey}
                  onChange={e => update('openaiApiKey', e.target.value)}
                  placeholder="sk-..."
                  className="input pr-10"
                />
                <button
                  onClick={() => setShowOpenAIKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showOpenAIKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
          </Section>

          {/* Story Defaults */}
          <Section title="Story Defaults" description="Default values for story generation">
            <Field label="Default AI Model">
              <select
                value={settings.defaultModel}
                onChange={e => update('defaultModel', e.target.value)}
                className="input"
              >
                {models.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Default Length">
              <select
                value={settings.defaultLength}
                onChange={e => update('defaultLength', e.target.value)}
                className="input"
              >
                <option value="short">Short (~400 words)</option>
                <option value="medium">Medium (~1000 words)</option>
                <option value="long">Long (~2000 words)</option>
              </select>
            </Field>
            <Field label="Auto-Generate Images">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => update('autoImageGen', !settings.autoImageGen)}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${settings.autoImageGen ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-border'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.autoImageGen ? 'translate-x-7' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-600 dark:text-dark-muted">
                  {settings.autoImageGen ? 'Enabled (requires OpenAI key)' : 'Disabled'}
                </span>
              </label>
            </Field>
          </Section>

          {/* Appearance */}
          <Section title="Appearance" description="Theme and display preferences">
            <Field label="Theme">
              <div className="flex gap-3">
                {(['light', 'dark'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => update('theme', t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all ${settings.theme === t ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-dark-muted hover:bg-gray-200 dark:hover:bg-dark-border'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          {/* TTS */}
          <Section title="Text-to-Speech" description="Voice and speed settings">
            <Field label="Speech Rate">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.25"
                  value={settings.ttsRate}
                  onChange={e => update('ttsRate', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600 dark:text-dark-muted w-12 text-right">{settings.ttsRate}x</span>
              </div>
            </Field>
            {voices.length > 0 && (
              <Field label="Voice">
                <select
                  value={settings.ttsVoice}
                  onChange={e => update('ttsVoice', e.target.value)}
                  className="input"
                >
                  <option value="">System Default</option>
                  {voices.map(v => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </Field>
            )}
          </Section>

          {/* Save */}
          <motion.button
            onClick={handleSave}
            disabled={isSaving}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/25 transition-colors flex items-center justify-center gap-2"
          >
            {isSaving ? <LoadingSpinner size={20} /> : <Save size={20} />}
            {isSaving ? 'Saving...' : 'Save Settings'}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

const Section: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-2xl p-6">
    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{title}</h2>
    <p className="text-sm text-gray-500 dark:text-dark-muted mb-6">{description}</p>
    <div className="flex flex-col gap-4">{children}</div>
  </div>
)

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">{label}</label>
    {hint && <p className="text-xs text-gray-400 dark:text-dark-muted mb-2">{hint}</p>}
    {children}
  </div>
)
