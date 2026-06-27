import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { Toast as ToastType } from '../hooks/useToast'

interface ToastContainerProps {
  toasts: ToastType[]
  onRemove: (id: string) => void
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const colors = {
  success: 'bg-green-500/90',
  error: 'bg-red-500/90',
  info: 'bg-primary-500/90',
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map(toast => {
          const Icon = icons[toast.type]
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`${colors[toast.type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-64 max-w-sm`}
            >
              <Icon size={18} className="shrink-0" />
              <span className="text-sm flex-1">{toast.message}</span>
              <button onClick={() => onRemove(toast.id)} className="shrink-0 hover:opacity-75">
                <X size={16} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
