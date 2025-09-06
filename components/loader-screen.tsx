"use client"

import { PulsingBorder } from "@paper-design/shaders-react"
import { motion } from "framer-motion"
import { useEffect } from "react"

export function LoaderScreen({ onDone }: { onDone?: () => void }) {
  useEffect(() => {
    if (onDone) {
      const timer = setTimeout(onDone, 2000)
      return () => clearTimeout(timer)
    }
  }, [onDone])

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <PulsingBorder
          colors={["#BEECFF", "#E77EDC", "#FF4C3E", "#00FF88", "#FFD700", "#FF6B35", "#8A2BE2"]}
          colorBack="#00000000"
          speed={1.5}
          roundness={1}
          thickness={0.12}
          softness={0.25}
          intensity={6}
          spotsPerColor={5}
          spotSize={0.12}
          pulse={0.12}
          smoke={0.6}
          smokeSize={4}
          scale={0.9}
          rotation={0}
          frame={9161408.251009725}
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
          }}
        />
        <motion.svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        >
          <defs>
            <path id="circle" d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
          </defs>
          <text className="text-sm fill-white/85">
            <textPath href="#circle" startOffset="0%">
              FANTOM • FANTOM • FANTOM • FANTOM •
            </textPath>
          </text>
        </motion.svg>
      </div>
    </div>
  )
}

export default LoaderScreen
