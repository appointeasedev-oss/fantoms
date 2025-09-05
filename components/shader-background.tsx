"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { MeshGradient } from "@paper-design/shaders-react"
import { useFantoms } from "./fantoms-context"
import { COLOR_THEMES } from "./settings-tab"

interface ShaderBackgroundProps {
  children: React.ReactNode
}

export function ShaderBackground({ children }: ShaderBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isActive, setIsActive] = useState(false)
  const { pantryId, bucket } = useFantoms()

  const [themeColors, setThemeColors] = useState<string[]>(COLOR_THEMES[0].colors)
  const [bgColor, setBgColor] = useState<string>(COLOR_THEMES[0].backgroundColor)

  useEffect(() => {
    const handleMouseEnter = () => setIsActive(true)
    const handleMouseLeave = () => setIsActive(false)

    const container = containerRef.current
    if (container) {
      container.addEventListener("mouseenter", handleMouseEnter)
      container.addEventListener("mouseleave", handleMouseLeave)
    }

    // Load settings from Pantry
    async function loadTheme() {
      if (!pantryId || !bucket) return

      try {
        const res = await fetch("/api/pantry/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pantryId, bucket }),
        })

        if (res.ok) {
          const data = await res.json()
          const colorThemeId = data.data?.colorTheme || "default"
          const theme = COLOR_THEMES.find((t) => t.id === colorThemeId) || COLOR_THEMES[0]
          setThemeColors(theme.colors)
          setBgColor(theme.backgroundColor)
        }
      } catch (err) {
        console.warn("Failed to fetch Pantry settings, fallback to default:", err)
        const theme = COLOR_THEMES[0]
        setThemeColors(theme.colors)
        setBgColor(theme.backgroundColor)
      }
    }

    loadTheme()

    return () => {
      if (container) {
        container.removeEventListener("mouseenter", handleMouseEnter)
        container.removeEventListener("mouseleave", handleMouseLeave)
      }
    }
  }, [pantryId, bucket])

  return (
    <div ref={containerRef} className="min-h-screen bg-black relative overflow-hidden">
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
      <MeshGradient
        className="absolute inset-0 w-full h-full"
        colors={themeColors}
        speed={0.3}
        backgroundColor={bgColor}
      />
      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-60"
        colors={[bgColor, "#ffffff", themeColors[1], bgColor]}
        speed={0.2}
        wireframe="true"
        backgroundColor="transparent"
      />

      {children}
    </div>
  )
}

export default ShaderBackground

