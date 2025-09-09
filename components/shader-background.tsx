"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { MeshGradient } from "@paper-design/shaders-react"

interface ShaderBackgroundProps {
  children: React.ReactNode
}

// Default theme colors
const DEFAULT_COLORS = ["#000000", "#8b5cf6", "#ffffff", "#1e1b4b", "#4c1d95"]
const DEFAULT_BG = "#000000"

export function ShaderBackground({ children }: ShaderBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [themeColors, setThemeColors] = useState<string[]>(DEFAULT_COLORS)
  const [bgColor, setBgColor] = useState<string>(DEFAULT_BG)
  const [pantryId, setPantryId] = useState<string | null>(null)
  const [bucket, setBucket] = useState<string | null>(null)
  const [textColor, setTextColor] = useState<string>("#ffffff")
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("")

  // Get pantry credentials from localStorage or context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPantryId = localStorage.getItem("fantoms.pantryId")
      const storedBucket = localStorage.getItem("fantoms.bucket")
      setPantryId(storedPantryId)
      setBucket(storedBucket)
    }
  }, [])

  useEffect(() => {
    const handleMouseEnter = () => setIsActive(true)
    const handleMouseLeave = () => setIsActive(false)

    const container = containerRef.current
    if (container) {
      container.addEventListener("mouseenter", handleMouseEnter)
      container.addEventListener("mouseleave", handleMouseLeave)
    }

    // Load theme from Pantry
    async function loadTheme() {
      if (!pantryId || !bucket) {
        // Use default theme if no pantry credentials
        setThemeColors(DEFAULT_COLORS)
        setBgColor(DEFAULT_BG)
        setTextColor("#ffffff")
        setBackgroundImageUrl("")
        return
      }

      try {
        const res = await fetch("/api/pantry/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pantryId, bucket }),
        })

        if (res.ok) {
          const data = await res.json()
          const colorThemeId = data.data?.colorTheme || "default"
          const userTextColor = data.data?.textColor || "#ffffff"
          const userBgImageUrl = data.data?.backgroundImageUrl || ""
          
          // Get theme from predefined themes
          const theme = getThemeById(colorThemeId)
          setThemeColors(theme.colors)
          setBgColor(theme.backgroundColor)
          setTextColor(userTextColor)
          setBackgroundImageUrl(userBgImageUrl)
        } else {
          // Fallback to default
          setThemeColors(DEFAULT_COLORS)
          setBgColor(DEFAULT_BG)
          setTextColor("#ffffff")
          setBackgroundImageUrl("")
        }
      } catch (err) {
        console.warn("Failed to fetch theme from Pantry, using default:", err)
        setThemeColors(DEFAULT_COLORS)
        setBgColor(DEFAULT_BG)
        setTextColor("#ffffff")
        setBackgroundImageUrl("")
      }
    }

    loadTheme()

    // Listen for theme changes
    const handleThemeChange = (event: CustomEvent) => {
      const { colors, backgroundColor, textColor: newTextColor, backgroundImageUrl: newBgImageUrl } = event.detail
      setThemeColors(colors)
      setBgColor(backgroundColor)
      if (newTextColor) setTextColor(newTextColor)
      if (newBgImageUrl !== undefined) setBackgroundImageUrl(newBgImageUrl)
    }

    window.addEventListener("themeChange", handleThemeChange as EventListener)

    return () => {
      if (container) {
        container.removeEventListener("mouseenter", handleMouseEnter)
        container.removeEventListener("mouseleave", handleMouseLeave)
      }
      window.removeEventListener("themeChange", handleThemeChange as EventListener)
    }
  }, [pantryId, bucket])

  // Apply text color and background image to document
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty("--app-text-color", textColor)
    
    if (backgroundImageUrl.trim()) {
      root.style.setProperty("--app-bg-image", `url(${backgroundImageUrl})`)
    } else {
      root.style.removeProperty("--app-bg-image")
    }
  }, [textColor, backgroundImageUrl])

  return (
    <div 
      ref={containerRef} 
      className="min-h-screen bg-black relative overflow-hidden"
      style={{
        backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: textColor
      }}
    >
      {/* SVG Filters */}
      <svg className="absolute inset-0 w-0 h-0">
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Background Shaders */}
      {!backgroundImageUrl && (
        <>
          <MeshGradient
            className="absolute inset-0 w-full h-full"
            colors={themeColors}
            speed={0.3}
            backgroundColor={bgColor}
          />
          <MeshGradient
            className="absolute inset-0 w-full h-full opacity-60"
            colors={[bgColor, "#ffffff", themeColors[1] || "#8b5cf6", bgColor]}
            speed={0.2}
            wireframe
            backgroundColor="transparent"
          />
        </>
      )}
      
      {backgroundImageUrl && (
        <div className="absolute inset-0 bg-black/30" />
      )}

      {children}
    </div>
  )
}

// Predefined color themes
function getThemeById(id: string) {
  const themes = [
    {
      id: "default",
      name: "Cosmic Purple",
      colors: ["#000000", "#8b5cf6", "#ffffff", "#1e1b4b", "#4c1d95"],
      backgroundColor: "#000000",
    },
    {
      id: "ocean",
      name: "Ocean Blue",
      colors: ["#001122", "#0ea5e9", "#ffffff", "#0c4a6e", "#075985"],
      backgroundColor: "#001122",
    },
    {
      id: "sunset",
      name: "Sunset Orange",
      colors: ["#1a0f0a", "#f97316", "#ffffff", "#9a3412", "#ea580c"],
      backgroundColor: "#1a0f0a",
    },
    {
      id: "forest",
      name: "Forest Green",
      colors: ["#0a1a0f", "#22c55e", "#ffffff", "#166534", "#15803d"],
      backgroundColor: "#0a1a0f",
    },
    {
      id: "rose",
      name: "Rose Pink",
      colors: ["#1a0a14", "#f43f5e", "#ffffff", "#9f1239", "#e11d48"],
      backgroundColor: "#1a0a14",
    },
    {
      id: "cyber",
      name: "Cyber Neon",
      colors: ["#0a0a1a", "#00ff88", "#ffffff", "#003322", "#00cc66"],
      backgroundColor: "#0a0a1a",
    },
    {
      id: "gold",
      name: "Golden Hour",
      colors: ["#1a1a0a", "#fbbf24", "#ffffff", "#92400e", "#f59e0b"],
      backgroundColor: "#1a1a0a",
    },
    {
      id: "arctic",
      name: "Arctic Ice",
      colors: ["#0f1419", "#06b6d4", "#ffffff", "#0e7490", "#0891b2"],
      backgroundColor: "#0f1419",
    },
  ]
  
  return themes.find(t => t.id === id) || themes[0]
}

export default ShaderBackground