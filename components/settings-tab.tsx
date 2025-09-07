"use client"

import React from "react"
import { useFantoms } from "./fantoms-context"

type ColorTheme = {
  id: string
  name: string
  colors: string[]
  backgroundColor: string
}

const COLOR_THEMES: ColorTheme[] = [
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
  {
    id: "monochrome",
    name: "Black & White",
    colors: ["#000000", "#ffffff", "#ffffff", "#333333", "#666666"],
    backgroundColor: "#000000",
  },
]

export function SettingsTab() {
  const { pantryId, bucket } = useFantoms()
  const [settings, setSettings] = React.useState<{
    colorTheme: string
    supabaseUrl: string
    supabaseAnonKey: string
    openrouterKey: string
  }>({
    colorTheme: "default",
    supabaseUrl: "",
    supabaseAnonKey: "",
    openrouterKey: "",
  })
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [showKeys, setShowKeys] = React.useState(false)

  // Load settings from Pantry
  React.useEffect(() => {
    if (!pantryId || !bucket) return

    async function loadSettings() {
      setLoading(true)
      try {
        const res = await fetch("/api/pantry/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pantryId, bucket }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.data) {
            setSettings({
              colorTheme: data.data.colorTheme || "default",
              supabaseUrl: data.data.supabaseUrl || "",
              supabaseAnonKey: data.data.supabaseAnonKey || "",
              openrouterKey: data.data.openrouterKey || "",
            })
          } else {
            const defaultSettings = {
              colorTheme: "default",
              supabaseUrl: "",
              supabaseAnonKey: "",
              openrouterKey: "",
              savedAt: new Date().toISOString(),
            }

            await fetch("/api/pantry/store", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pantryId, bucket, data: defaultSettings }),
            })

            setSettings(defaultSettings)
          }
        }
      } catch (e) {
        console.error("Failed to load settings:", e)
        setSettings((prev) => ({ ...prev, colorTheme: "default" }))
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [pantryId, bucket])

  // Apply theme to background and store in localStorage for quiz pages
  React.useEffect(() => {
    const theme = COLOR_THEMES.find((t) => t.id === settings.colorTheme) || COLOR_THEMES[0]

    const root = document.documentElement
    root.style.setProperty("--shader-colors", theme.colors.join(","))
    root.style.setProperty("--shader-bg", theme.backgroundColor)
    root.style.setProperty("--theme-primary", theme.colors[1])
    root.style.setProperty("--theme-accent", theme.colors[3])

    localStorage.setItem("fantoms-theme", JSON.stringify(theme))

    window.dispatchEvent(
      new CustomEvent("themeChange", {
        detail: { colors: theme.colors, backgroundColor: theme.backgroundColor },
      }),
    )
  }, [settings.colorTheme])

  async function saveSettings() {
    if (!pantryId || !bucket) return

    setSaving(true)
    try {
      const payload = {
        ...settings,
        savedAt: new Date().toISOString(),
      }

      const res = await fetch("/api/pantry/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pantryId, bucket, data: payload }),
      })

      if (!res.ok) {
        throw new Error("Failed to save settings")
      }

      alert("Settings saved successfully!")
    } catch (e: any) {
      alert(`Failed to save settings: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  function updateSetting<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="p-4 text-white">
        <h2 className="text-xl font-semibold mb-4">Settings</h2>
        <div className="opacity-80">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="p-4 text-white space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Settings</h2>
        <button
          className="px-4 py-2 rounded bg-cyan-500 text-black text-sm font-medium disabled:opacity-50"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Color Theme Section */}
      <section className="p-4 rounded-lg bg-white/5 border border-white/10">
        <h3 className="text-lg font-medium mb-4">Color Theme</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.id}
              className={`p-3 rounded-lg border transition-all duration-200 ${
                settings.colorTheme === theme.id
                  ? "border-cyan-400 bg-cyan-500/20"
                  : "border-white/20 bg-white/5 hover:bg-white/10"
              }`}
              onClick={() => updateSetting("colorTheme", theme.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-4 rounded-full border border-white/30"
                  style={{ backgroundColor: theme.colors[1] }}
                />
                <div
                  className="w-4 h-4 rounded-full border border-white/30"
                  style={{ backgroundColor: theme.colors[2] }}
                />
                <div
                  className="w-4 h-4 rounded-full border border-white/30"
                  style={{ backgroundColor: theme.colors[3] }}
                />
              </div>
              <div className="text-sm font-medium">{theme.name}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Supabase Configuration */}
      <section className="p-4 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Supabase Configuration</h3>
          <button className="px-3 py-1 rounded bg-white/20 text-white text-sm" onClick={() => setShowKeys(!showKeys)}>
            {showKeys ? "Hide" : "Show"} Keys
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm opacity-90 mb-1">Supabase URL</label>
            <input
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/40"
              value={settings.supabaseUrl}
              onChange={(e) => updateSetting("supabaseUrl", e.target.value)}
              placeholder="https://your-project.supabase.co"
              type={showKeys ? "text" : "password"}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm opacity-90 mb-1">Supabase Anon Key</label>
            <input
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/40"
              value={settings.supabaseAnonKey}
              onChange={(e) => updateSetting("supabaseAnonKey", e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              type={showKeys ? "text" : "password"}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm opacity-90 mb-1">OpenRouter API Key</label>
            <input
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/40"
              value={settings.openrouterKey}
              onChange={(e) => updateSetting("openrouterKey", e.target.value)}
              placeholder="sk-or-v1-..."
              type={showKeys ? "text" : "password"}
              autoComplete="off"
            />
          </div>
        </div>
      </section>

      {/* Pantry Information */}
      <section className="p-4 rounded-lg bg-white/5 border border-white/10">
        <h3 className="text-lg font-medium mb-4">Pantry Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="opacity-80">Pantry ID:</span>
            <span className="font-mono">{pantryId}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-80">Bucket:</span>
            <span className="font-mono">{bucket}</span>
          </div>
        </div>
      </section>

      {/* App Information */}
      <section className="p-4 rounded-lg bg-white/5 border border-white/10">
        <h3 className="text-lg font-medium mb-4">About Fantoms</h3>
        <div className="text-sm opacity-80 space-y-2">
          <p>Fantoms is a quiz management platform that allows you to create, manage, and share interactive quizzes.</p>
          <p>All data is stored securely in your own Supabase database with multi-tenant isolation.</p>
        </div>
      </section>
    </div>
  )
}

export { COLOR_THEMES }
export default SettingsTab
