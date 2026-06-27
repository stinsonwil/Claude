import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ToastContainer } from './Toast'
import { useToast } from '../hooks/useToast'

export const ToastContext = React.createContext<ReturnType<typeof useToast>>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

export const Layout: React.FC = () => {
  const toastState = useToast()

  return (
    <ToastContext.Provider value={toastState}>
      <div className="flex h-screen bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
        <ToastContainer toasts={toastState.toasts} onRemove={toastState.removeToast} />
      </div>
    </ToastContext.Provider>
  )
}
