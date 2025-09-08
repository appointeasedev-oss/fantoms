"use client"

import React, { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface SecureQuizWrapperProps {
  children: React.ReactNode
  onSecurityViolation?: () => void
}

export function SecureQuizWrapper({ children, onSecurityViolation }: SecureQuizWrapperProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [violations, setViolations] = useState(0)

  // Check fullscreen status
  const checkFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    )
    setIsFullscreen(isCurrentlyFullscreen)
    if (!isCurrentlyFullscreen) {
      setShowWarning(true)
    }
  }, [])

  // Enter fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      const element = document.documentElement
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen()
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen()
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen()
      }
      setShowWarning(false)
    } catch (error) {
      console.error("Failed to enter fullscreen:", error)
    }
  }, [])

  // Security violation handler
  const handleSecurityViolation = useCallback((type: string) => {
    setViolations(prev => prev + 1)
    console.warn(`Security violation detected: ${type}`)
    if (onSecurityViolation) {
      onSecurityViolation()
    }
  }, [onSecurityViolation])

  // Prevent screenshots and screen recording
  useEffect(() => {
    const preventScreenshot = (e: Event) => {
      e.preventDefault()
      handleSecurityViolation("screenshot_attempt")
      return false
    }

    // Prevent print screen
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Print Screen
      if (e.key === "PrintScreen") {
        e.preventDefault()
        handleSecurityViolation("print_screen")
        return false
      }
      
      // Prevent Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === "I") {
        e.preventDefault()
        handleSecurityViolation("devtools_attempt")
        return false
      }
      
      // Prevent F12 (DevTools)
      if (e.key === "F12") {
        e.preventDefault()
        handleSecurityViolation("devtools_attempt")
        return false
      }
      
      // Prevent Ctrl+U (View Source)
      if (e.ctrlKey && e.key === "u") {
        e.preventDefault()
        handleSecurityViolation("view_source")
        return false
      }
      
      // Prevent Ctrl+S (Save)
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault()
        handleSecurityViolation("save_attempt")
        return false
      }
      
      // Prevent Ctrl+A (Select All)
      if (e.ctrlKey && e.key === "a") {
        e.preventDefault()
        handleSecurityViolation("select_all")
        return false
      }
      
      // Prevent Ctrl+C (Copy)
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault()
        handleSecurityViolation("copy_attempt")
        return false
      }
      
      // Prevent Ctrl+V (Paste)
      if (e.ctrlKey && e.key === "v") {
        e.preventDefault()
        handleSecurityViolation("paste_attempt")
        return false
      }
      
      // Prevent Ctrl+X (Cut)
      if (e.ctrlKey && e.key === "x") {
        e.preventDefault()
        handleSecurityViolation("cut_attempt")
        return false
      }
      
      // Prevent Alt+Tab (Task switching)
      if (e.altKey && e.key === "Tab") {
        e.preventDefault()
        handleSecurityViolation("task_switch")
        return false
      }
      
      // Prevent Windows key
      if (e.key === "Meta" || e.key === "OS") {
        e.preventDefault()
        handleSecurityViolation("windows_key")
        return false
      }
    }

    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      handleSecurityViolation("context_menu")
      return false
    }

    // Prevent text selection
    const handleSelectStart = (e: Event) => {
      e.preventDefault()
      handleSecurityViolation("text_selection")
      return false
    }

    // Prevent drag
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault()
      handleSecurityViolation("drag_attempt")
      return false
    }

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("selectstart", handleSelectStart)
    document.addEventListener("dragstart", handleDragStart)

    // Prevent screenshot via media capture
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia
      navigator.mediaDevices.getDisplayMedia = function() {
        handleSecurityViolation("screen_capture")
        return Promise.reject(new Error("Screen capture blocked"))
      }
    }
    
    // Prevent clipboard access
    const preventClipboard = (e: ClipboardEvent) => {
      e.preventDefault()
      handleSecurityViolation("clipboard_access")
      return false
    }
    
    document.addEventListener("copy", preventClipboard)
    document.addEventListener("cut", preventClipboard)
    document.addEventListener("paste", preventClipboard)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("selectstart", handleSelectStart)
      document.removeEventListener("dragstart", handleDragStart)
      document.removeEventListener("copy", preventClipboard)
      document.removeEventListener("cut", preventClipboard)
      document.removeEventListener("paste", preventClipboard)
    }
  }, [handleSecurityViolation])

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      checkFullscreen()
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("mozfullscreenchange", handleFullscreenChange)
    document.addEventListener("MSFullscreenChange", handleFullscreenChange)

    // Initial check
    checkFullscreen()

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange)
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
    }
  }, [checkFullscreen])

  // Monitor window focus/blur for tab switching detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleSecurityViolation("tab_switch")
      }
    }

    const handleBlur = () => {
      handleSecurityViolation("window_blur")
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", handleBlur)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleBlur)
    }
  }, [handleSecurityViolation])

  return (
    <div className="relative min-h-screen">
      {/* Security CSS to prevent selection and screenshots */}
      <style jsx global>{`
        * {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-touch-callout: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        
        input, textarea {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
        }
        
        body {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
        
        /* Prevent screenshot overlays */
        .secure-content {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          user-select: none !important;
          pointer-events: auto;
        }
        
        /* Hide scrollbars to prevent screenshot context */
        ::-webkit-scrollbar {
          display: none;
        }
        
        * {
          scrollbar-width: none;
        }
        
        /* Additional security measures */
        img {
          -webkit-user-drag: none !important;
          -khtml-user-drag: none !important;
          -moz-user-drag: none !important;
          -o-user-drag: none !important;
          user-drag: none !important;
          pointer-events: none !important;
        }
        
        /* Prevent text highlighting */
        ::selection {
          background: transparent !important;
        }
        
        ::-moz-selection {
          background: transparent !important;
        }
        
        /* Disable outline on focus */
        *:focus {
          outline: none !important;
        }
        
        /* Prevent zoom */
        * {
          touch-action: manipulation !important;
        }
      `}</style>

      {/* Main content - only show when in fullscreen */}
      <div className={`secure-content ${!isFullscreen ? 'hidden' : ''}`}>
        {children}
      </div>

      {/* Fullscreen warning overlay */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          >
            <div className="max-w-md mx-4 p-8 bg-red-900/90 border border-red-500 rounded-xl text-white text-center backdrop-blur-sm">
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-2">Quiz Security Alert</h2>
                <p className="text-red-200 mb-6">
                  This quiz must be taken in fullscreen mode for security purposes. 
                  Please return to fullscreen to continue.
                </p>
              </div>

              <div className="space-y-4 mb-6 text-sm text-red-200">
                <div className="p-3 bg-red-800/50 rounded-lg">
                  <h3 className="font-semibold mb-2">Quiz Rules:</h3>
                  <ul className="text-left space-y-1">
                    <li>• Must remain in fullscreen mode</li>
                    <li>• No screenshots or screen recording</li>
                    <li>• No text copying or selection</li>
                    <li>• No tab switching or window changes</li>
                    <li>• No external tools or applications</li>
                  </ul>
                </div>
                
                {violations > 0 && (
                  <div className="p-3 bg-yellow-800/50 rounded-lg border border-yellow-500">
                    <p className="font-semibold">⚠️ Security Violations: {violations}</p>
                    <p className="text-xs">Multiple violations may result in quiz termination</p>
                  </div>
                )}
              </div>

              <button
                onClick={enterFullscreen}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Enter Fullscreen Mode
              </button>

              <p className="text-xs text-red-300 mt-4">
                By continuing, you agree to follow all quiz security protocols
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security violation counter (for debugging - remove in production) */}
      {process.env.NODE_ENV === 'development' && violations > 0 && (
        <div className="fixed top-4 right-4 z-40 p-2 bg-red-600 text-white text-xs rounded">
          Violations: {violations}
        </div>
      )}
    </div>
  )
}

export default SecureQuizWrapper