import React from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, BookOpen, Heart, Settings } from 'lucide-react'

const navItems = [
  { to: '/', icon: Sparkles, label: 'Generate' },
  { to: '/story', icon: BookOpen, label: 'Story' },
  { to: '/favorites', icon: Heart, label: 'Favorites' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export const Sidebar: React.FC = () => {
  return (
    <div className="w-64 h-full bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">StorySpark</h1>
            <p className="text-xs text-gray-500 dark:text-dark-muted">AI Storyteller</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 flex flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                  : 'text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-bg hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute inset-0 bg-primary-500 rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon size={20} />
                <span className="font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Version */}
      <div className="p-4 text-xs text-gray-400 dark:text-dark-muted text-center">
        StorySpark v1.0.0
      </div>
    </div>
  )
}
