import React, { useState, useContext, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Play, Pause, Square, Copy, Download, Heart,
  ZoomIn, ZoomOut, Sun, Moon, Image, RefreshCw
} from 'lucide-react'
import { ToastContext } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useTTS } from '../hooks/useTTS'
import { useThemeContext } from '../components/ThemeProvider'
import { storageService } from '../services/storageService'
import { imageService } from '../services/imageService'
import { Story, Settings } from '../types'

export const StoryViewer: React.FC = () => {
  const navigate = useNavigate()
  const { addToast } = useContext(ToastContext)
  const { theme, toggleTheme } = useThemeContext()
  const { state: ttsState, play, pause, resume, stop, rate, updateRate } = useTTS()

  const [story, setStory] = useState<Story | null>(null)
  const [fontSize, setFontSize] = useState(16)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('currentStory')
    if (stored) {
      setStory(JSON.parse(stored) as Story)
    }
    storageService.getSettings().then(setSettings)
  }, [])

  const handlePlayPause = useCallback(() => {
    if (!story) return
    if (ttsState === 'idle') {
      play(story.content, settings?.ttsVoice)
    } else if (ttsState === 'playing') {
      pause()
    } else {
      resume()
    }
  }, [story, ttsState, play, pause, resume, settings])

  const handleCopy = useCallback(async () => {
    if (!story) return
    await navigator.clipboard.writeText(`${story.title}\n\n${story.content}`)
    addToast('Copied to clipboard!', 'success')
  }, [story, addToast])

  const handleExportTxt = useCallback(() => {
    if (!story) return
    const blob = new Blob([`${story.title}\n\n${story.content}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${story.title.replace(/[^a-z0-9]/gi, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    addToast('Story exported as TXT', 'success')
  }, [story, addToast])

  const handleExportPdf = useCallback(() => {
    if (!story) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>${story.title}</title>
      <style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;line-height:1.8;font-size:16px}h1{font-size:24px;margin-bottom:20px}</style>
      </head><body>
      <h1>${story.title}</h1>
      <p>${story.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
    addToast('Print dialog opened for PDF export', 'info')
  }, [story, addToast])

  const handleSaveFavorite = useCallback(async () => {
    if (!story || isSaved) return
    setIsSaving(true)
    try {
      await storageService.saveFavorite(story)
      setIsSaved(true)
      addToast('Story saved to favorites!', 'success')
    } catch {
      addToast('Failed to save story', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [story, isSaved, addToast])

  const handleGenerateImage = useCallback(async () => {
    if (!story || !settings?.openaiApiKey) {
      addToast('OpenAI API key required for image generation. Add it in Settings.', 'error')
      return
    }
    setIsGeneratingImage(true)
    try {
      const prompt = imageService.buildPromptFromStory(story.title, story.genre, story.content)
      const url = await imageService.generate(prompt, settings.openaiApiKey)
      const updated = { ...story, imageUrl: url }
      setStory(updated)
      sessionStorage.setItem('currentStory', JSON.stringify(updated))
      addToast('Image generated!', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to generate image', 'error')
    } finally {
      setIsGeneratingImage(false)
    }
  }, [story, settings, addToast])

  if (!story) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <p className="text-gray-500 dark:text-dark-muted text-lg">No story loaded yet.</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors"
        >
          Generate a Story
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-6 py-3 flex items-center gap-3 flex-wrap">
        {/* TTS Controls */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-bg rounded-xl p-1">
          <button
            onClick={handlePlayPause}
            className="p-2 hover:bg-primary-500 hover:text-white rounded-lg transition-colors"
            title={ttsState === 'playing' ? 'Pause' : ttsState === 'paused' ? 'Resume' : 'Play'}
          >
            {ttsState === 'playing' ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={stop}
            disabled={ttsState === 'idle'}
            className="p-2 hover:bg-red-500 hover:text-white rounded-lg transition-colors disabled:opacity-30"
            title="Stop"
          >
            <Square size={16} />
          </button>
          <select
            value={rate}
            onChange={e => updateRate(parseFloat(e.target.value))}
            className="text-xs bg-transparent border-none outline-none text-gray-600 dark:text-dark-muted cursor-pointer px-1"
          >
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(r => (
              <option key={r} value={r}>{r}x</option>
            ))}
          </select>
        </div>

        {/* Font Size */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-bg rounded-xl p-1">
          <button
            onClick={() => setFontSize(s => Math.max(12, s - 2))}
            className="p-2 hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs px-2 text-gray-600 dark:text-dark-muted">{fontSize}px</span>
          <button
            onClick={() => setFontSize(s => Math.min(28, s + 2))}
            className="p-2 hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-dark-border rounded-xl transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="flex-1" />

        {/* Actions */}
        <button onClick={handleCopy} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-xl transition-colors" title="Copy">
          <Copy size={16} />
        </button>
        <button onClick={handleExportTxt} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-xl transition-colors" title="Export TXT">
          <Download size={16} />
        </button>
        <button onClick={handleExportPdf} className="px-3 py-2 text-xs bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-dark-border rounded-xl transition-colors">
          PDF
        </button>
        <button
          onClick={handleSaveFavorite}
          disabled={isSaved || isSaving}
          className={`p-2 rounded-xl transition-colors ${isSaved ? 'text-red-500' : 'hover:bg-gray-100 dark:hover:bg-dark-bg'}`}
          title={isSaved ? 'Saved!' : 'Save to Favorites'}
        >
          <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-xl transition-colors"
          title="New Story"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          {/* Image */}
          {story.imageUrl ? (
            <motion.img
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              src={story.imageUrl}
              alt={story.title}
              className="w-full rounded-2xl mb-8 shadow-xl"
            />
          ) : (
            <div className="w-full h-48 bg-gray-100 dark:bg-dark-card rounded-2xl mb-8 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 dark:border-dark-border">
              {isGeneratingImage ? (
                <LoadingSpinner size={32} message="Generating illustration..." />
              ) : (
                <>
                  <Image size={32} className="text-gray-300 dark:text-dark-border" />
                  <button
                    onClick={handleGenerateImage}
                    className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Generate Illustration
                  </button>
                </>
              )}
            </div>
          )}

          {/* Story */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-primary-500/10 text-primary-500 rounded-full text-xs font-medium capitalize">
                {story.genre}
              </span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-dark-bg text-gray-500 dark:text-dark-muted rounded-full text-xs capitalize">
                {story.length}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              {story.title}
            </h1>
            <div
              className="prose dark:prose-invert max-w-none text-gray-700 dark:text-dark-text leading-relaxed"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
            >
              {story.content.split('\n\n').map((para, i) => (
                <p key={i} className="mb-4">{para}</p>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
