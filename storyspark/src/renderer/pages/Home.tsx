import React, { useState, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ToastContext } from '../components/Layout'
import { storyService } from '../services/storyService'
import { imageService } from '../services/imageService'
import { storageService } from '../services/storageService'
import { Story, Settings } from '../types'

const genres = [
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'horror', label: 'Horror' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'romance', label: 'Romance' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'custom', label: 'Custom' },
]

const lengths = [
  { value: 'short', label: 'Short', desc: '~400 words' },
  { value: 'medium', label: 'Medium', desc: '~1000 words' },
  { value: 'long', label: 'Long', desc: '~2000 words' },
]

export const Home: React.FC = () => {
  const navigate = useNavigate()
  const { addToast } = useContext(ToastContext)
  const [genre, setGenre] = useState('fantasy')
  const [length, setLength] = useState('medium')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    storageService.getSettings().then(s => {
      setSettings(s)
      setLength(s.defaultLength || 'medium')
    })
  }, [])

  const handleGenerate = async () => {
    if (!settings?.anthropicApiKey) {
      addToast('Please add your Anthropic API key in Settings first.', 'error')
      navigate('/settings')
      return
    }

    setIsGenerating(true)
    try {
      const story = await storyService.generate({
        genre,
        length,
        customPrompt: genre === 'custom' ? customPrompt : undefined,
        apiKey: settings.anthropicApiKey,
        model: settings.defaultModel || 'claude-3-haiku-20240307',
      })

      let imageUrl: string | undefined
      if (settings.autoImageGen && settings.openaiApiKey) {
        try {
          const prompt = imageService.buildPromptFromStory(story.title, story.genre, story.content)
          imageUrl = await imageService.generate(prompt, settings.openaiApiKey)
        } catch {
          addToast('Image generation failed, continuing without image.', 'info')
        }
      }

      const storyWithImage: Story = { ...story, imageUrl }
      sessionStorage.setItem('currentStory', JSON.stringify(storyWithImage))
      navigate('/story')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to generate story', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-primary-500/10 rounded-2xl mb-6"
          >
            <Sparkles size={40} className="text-primary-500" />
          </motion.div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Create Your Story
          </h1>
          <p className="text-gray-500 dark:text-dark-muted text-lg">
            Let AI craft a unique story just for you
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-dark-card rounded-2xl shadow-xl dark:shadow-none border border-gray-100 dark:border-dark-border p-8">
          {/* Genre */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-dark-text mb-3">
              Genre
            </label>
            <div className="grid grid-cols-4 gap-2">
              {genres.map(g => (
                <button
                  key={g.value}
                  onClick={() => setGenre(g.value)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                    genre === g.value
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                      : 'bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-dark-muted hover:bg-gray-200 dark:hover:bg-dark-border'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          {genre === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6"
            >
              <label className="block text-sm font-semibold text-gray-700 dark:text-dark-text mb-2">
                Your Story Idea
              </label>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Describe your story idea, setting, characters, or theme..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </motion.div>
          )}

          {/* Length */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-gray-700 dark:text-dark-text mb-3">
              Story Length
            </label>
            <div className="flex gap-3">
              {lengths.map(l => (
                <button
                  key={l.value}
                  onClick={() => setLength(l.value)}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm transition-all ${
                    length === l.value
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                      : 'bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-dark-muted hover:bg-gray-200 dark:hover:bg-dark-border'
                  }`}
                >
                  <div className="font-semibold">{l.label}</div>
                  <div className="text-xs opacity-75">{l.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <motion.button
            onClick={handleGenerate}
            disabled={isGenerating}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-primary-500/25 transition-colors flex items-center justify-center gap-3"
          >
            {isGenerating ? (
              <>
                <LoadingSpinner size={20} />
                <span>Crafting your story...</span>
              </>
            ) : (
              <>
                <Sparkles size={20} />
                <span>Generate Story</span>
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
