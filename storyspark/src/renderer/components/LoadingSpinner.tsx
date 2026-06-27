import React from 'react'
import { motion } from 'framer-motion'

interface LoadingSpinnerProps {
  size?: number
  message?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 40, message }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <motion.div
        className="rounded-full border-4 border-primary-500/30 border-t-primary-500"
        style={{ width: size, height: size }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {message && (
        <p className="text-dark-muted dark:text-dark-muted text-slate-500 text-sm">{message}</p>
      )}
    </div>
  )
}
