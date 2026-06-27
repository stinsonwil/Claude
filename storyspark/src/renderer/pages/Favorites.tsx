import React, { useState, useEffect, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Search, Trash2, BookOpen, Calendar } from 'lucide-react'
import { ToastContext } from '../components/Layout'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { storageService } from '../services/storageService'
import { Story } from '../types'

export const Favorites: React.FC = () => {
  const navigate = useNavigate()
  const { addToast } = useContext(ToastContext)
  const [favorites, setFavorites] = useState<Story[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const loadFavorites = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await storageService.getFavorites()
      setFavorites(data)
    } catch {
      addToast('Failed to load favorites', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const handleDelete = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await storageService.deleteFavorite(id)
      setFavorites(prev => prev.filter(f => f.id !== id))
      addToast('Story removed from favorites', 'info')
    } catch {
      addToast('Failed to delete story', 'error')
    }
  }, [addToast])

  const handleOpen = useCallback((story: Story) => {
    sessionStorage.setItem('currentStory', JSON.stringify(story))
    navigate('/story')
  }, [navigate])

  const filtered = favorites.filter(f =>
    f.title.toLowerCase().includes(search.toLowerCase()) ||
    f.genre.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-8 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <Heart size={28} className="text-red-500" fill="currentColor" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Favorites</h1>
          <span className="ml-auto px-3 py-1 bg-gray-100 dark:bg-dark-card rounded-full text-sm text-gray-500 dark:text-dark-muted">
            {favorites.length} stories
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search favorites..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-xl text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <LoadingSpinner message="Loading favorites..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <Heart size={48} className="text-gray-200 dark:text-dark-border" />
            <p className="text-gray-500 dark:text-dark-muted">
              {search ? 'No stories match your search' : 'No favorites yet. Save some stories!'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 gap-4">
              {filtered.map(story => (
                <motion.div
                  key={story.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={() => handleOpen(story)}
                  className="bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border rounded-xl p-5 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-4">
                    {story.imageUrl && (
                      <img
                        src={story.imageUrl}
                        alt={story.title}
                        className="w-20 h-20 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-primary-500/10 text-primary-500 rounded text-xs font-medium capitalize">
                          {story.genre}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-dark-muted capitalize">
                          {story.length}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-500 transition-colors">
                        {story.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-dark-muted mt-1 line-clamp-2">
                        {story.content.slice(0, 150)}...
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 dark:text-dark-muted">
                        <Calendar size={12} />
                        <span>{new Date(story.savedAt || story.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => handleDelete(story.id!, e)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-500 rounded-lg transition-colors">
                        <BookOpen size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
