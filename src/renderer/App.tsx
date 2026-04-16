import React, { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, Camera, HeadCircuit } from '@phosphor-icons/react'
import { TabStrip } from './components/TabStrip'
import { ConversationView } from './components/ConversationView'
import { InputBar } from './components/InputBar'
import { StatusBar } from './components/StatusBar'
import { MarketplacePanel } from './components/MarketplacePanel'
import { PopoverLayerProvider } from './components/PopoverLayer'
import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useHealthReconciliation } from './hooks/useHealthReconciliation'
import { useSessionStore } from './stores/sessionStore'
import { useColors, useThemeStore, spacing } from './theme'

const TRANSITION = { duration: 0.26, ease: [0.4, 0, 0.1, 1] as const }

export default function App() {
  useClaudeEvents()
  useHealthReconciliation()

  const activeTabStatus = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.status)
  const addAttachments = useSessionStore((s) => s.addAttachments)
  const colors = useColors()
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme)
  const expandedUI = useThemeStore((s) => s.expandedUI)

  // ─── Theme initialization ───
  useEffect(() => {
    // Send persisted placement to main process so the window starts in the right position
    const savedPlacement = useThemeStore.getState().placement
    if (savedPlacement !== 'bottom-center') {
      window.clui.setPlacement?.(savedPlacement)
    }

    // Get initial OS theme — setSystemTheme respects themeMode (system/light/dark)
    window.clui.getTheme().then(({ isDark }) => {
      setSystemTheme(isDark)
    }).catch(() => {})

    // Listen for OS theme changes
    const unsub = window.clui.onThemeChange((isDark) => {
      setSystemTheme(isDark)
    })
    return unsub
  }, [setSystemTheme])

  useEffect(() => {
    useSessionStore.getState().initStaticInfo().then(() => {
      const homeDir = useSessionStore.getState().staticInfo?.homePath || '~'
      const tab = useSessionStore.getState().tabs[0]
      if (tab) {
        // Set working directory to home by default (user hasn't chosen yet)
        useSessionStore.setState((s) => ({
          tabs: s.tabs.map((t, i) => (i === 0 ? { ...t, workingDirectory: homeDir, hasChosenDirectory: false } : t)),
        }))
        window.clui.createTab().then(({ tabId }) => {
          useSessionStore.setState((s) => ({
            tabs: s.tabs.map((t, i) => (i === 0 ? { ...t, id: tabId } : t)),
            activeTabId: tabId,
          }))
        }).catch(() => {})
      }
    })
  }, [])

  // OS-level click-through (RAF-throttled to avoid per-pixel IPC)
  useEffect(() => {
    if (!window.clui?.setIgnoreMouseEvents) return
    let lastIgnored: boolean | null = null

    const onMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const isUI = !!(el && el.closest('[data-clui-ui]'))
      const shouldIgnore = !isUI
      if (shouldIgnore !== lastIgnored) {
        lastIgnored = shouldIgnore
        if (shouldIgnore) {
          window.clui.setIgnoreMouseEvents(true, { forward: true })
        } else {
          window.clui.setIgnoreMouseEvents(false)
        }
      }
    }

    const onMouseLeave = () => {
      if (lastIgnored !== true) {
        lastIgnored = true
        window.clui.setIgnoreMouseEvents(true, { forward: true })
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  const isExpanded = useSessionStore((s) => s.isExpanded)
  const marketplaceOpen = useSessionStore((s) => s.marketplaceOpen)
  const placement = useThemeStore((s) => s.placement)
  const isRunning = activeTabStatus === 'running' || activeTabStatus === 'connecting'

  // Layout dimensions — expandedUI widens and heightens the panel
  const contentWidth = expandedUI ? 700 : spacing.contentWidth
  const cardExpandedWidth = expandedUI ? 700 : 460
  const cardCollapsedWidth = expandedUI ? 670 : 430
  const cardCollapsedMargin = expandedUI ? 15 : 15
  const bodyMaxHeight = expandedUI ? 520 : 400

  // Placement-driven layout
  const isTop = placement.startsWith('top')
  const isLeft = placement.includes('left')
  const isRight = placement.includes('right')
  const hAlign: 'flex-start' | 'center' | 'flex-end' = isLeft ? 'flex-start' : isRight ? 'flex-end' : 'center'

  // ─── Drag-to-resize ───
  const resizedHeight = useThemeStore((s) => s.resizedHeight)
  const setResizedHeight = useThemeStore((s) => s.setResizedHeight)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ y: number; startHeight: number } | null>(null)

  const effectiveBodyMaxHeight = resizedHeight ?? bodyMaxHeight

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startHeight = resizedHeight ?? bodyMaxHeight
    dragStartRef.current = { y: e.clientY, startHeight }
    setIsDragging(true)

    const onMove = (ev: PointerEvent) => {
      if (!dragStartRef.current) return
      const delta = isTop
        ? ev.clientY - dragStartRef.current.y
        : dragStartRef.current.y - ev.clientY
      const newHeight = Math.max(150, Math.min(600, dragStartRef.current.startHeight + delta))
      setResizedHeight(newHeight)
    }

    const onUp = () => {
      dragStartRef.current = null
      setIsDragging(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [isTop, resizedHeight, bodyMaxHeight, setResizedHeight])

  const handleScreenshot = useCallback(async () => {
    const result = await window.clui.takeScreenshot()
    if (!result) return
    addAttachments([result])
  }, [addAttachments])

  const handleAttachFile = useCallback(async () => {
    const files = await window.clui.attachFiles()
    if (!files || files.length === 0) return
    addAttachments(files)
  }, [addAttachments])

  return (
    <PopoverLayerProvider>
      <div
        className="flex h-full"
        style={{
          background: 'transparent',
          flexDirection: isTop ? 'column' : 'column',
          justifyContent: isTop ? 'flex-start' : 'flex-end',
          alignItems: hAlign,
        }}
      >

        {/* ─── 460px content column, centered. Circles overflow left. ─── */}
        <div style={{ width: contentWidth, position: 'relative', margin: '0 auto', transition: 'width 0.26s cubic-bezier(0.4, 0, 0.1, 1)', display: 'flex', flexDirection: 'column' }}>

          <AnimatePresence initial={false}>
            {marketplaceOpen && (
              <div
                data-clui-ui
                style={{
                  width: 720,
                  maxWidth: 720,
                  marginLeft: '50%',
                  transform: 'translateX(-50%)',
                  ...(isTop ? { marginTop: 14 } : { marginBottom: 14 }),
                  position: 'relative',
                  zIndex: 30,
                  order: isTop ? 3 : 0,
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: isTop ? -14 : 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: isTop ? -10 : 10, scale: 0.985 }}
                  transition={TRANSITION}
                >
                  <div
                    data-clui-ui
                    className="glass-surface overflow-hidden no-drag"
                    style={{
                      borderRadius: 24,
                      maxHeight: 470,
                    }}
                  >
                    <MarketplacePanel />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/*
            ─── Tabs / message shell ───
            This always remains the chat shell. The marketplace is a separate
            panel rendered above/below it, never inside it.
          */}
          <motion.div
            data-clui-ui
            className="overflow-hidden flex flex-col drag-region"
            animate={{
              width: isExpanded ? cardExpandedWidth : cardCollapsedWidth,
              ...(isTop
                ? { marginTop: isExpanded ? 10 : -14 }
                : { marginBottom: isExpanded ? 10 : -14 }),
              marginLeft: isExpanded ? 0 : cardCollapsedMargin,
              marginRight: isExpanded ? 0 : cardCollapsedMargin,
              background: isExpanded ? colors.containerBg : colors.containerBgCollapsed,
              borderColor: colors.containerBorder,
              boxShadow: isExpanded ? colors.cardShadow : colors.cardShadowCollapsed,
            }}
            transition={TRANSITION}
            style={{
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 20,
              position: 'relative',
              zIndex: isExpanded ? 20 : 10,
              order: isTop ? 2 : 1,
            }}
          >
            {/* Resize handle — top of card for bottom-* placements */}
            {!isTop && isExpanded && (
              <div
                data-clui-ui
                className="no-drag flex justify-center items-center"
                style={{ height: 10, cursor: 'ns-resize', flexShrink: 0 }}
                onPointerDown={handleResizeStart}
              >
                <div
                  style={{
                    width: 32,
                    height: 3,
                    borderRadius: 2,
                    background: isDragging ? colors.accent : colors.containerBorder,
                    transition: isDragging ? 'none' : 'background 0.15s',
                  }}
                />
              </div>
            )}

            {/* Tab strip — always mounted */}
            <div className="no-drag">
              <TabStrip />
            </div>

            {/* Body — chat history only */}
            <motion.div
              initial={false}
              animate={{
                height: isExpanded ? 'auto' : 0,
                opacity: isExpanded ? 1 : 0,
              }}
              transition={TRANSITION}
              className="overflow-hidden no-drag"
            >
              <div style={{ maxHeight: effectiveBodyMaxHeight }}>
                <ConversationView />
                <StatusBar />
              </div>
            </motion.div>

            {/* Resize handle — bottom of card for top-* placements */}
            {isTop && isExpanded && (
              <div
                data-clui-ui
                className="no-drag flex justify-center items-center"
                style={{ height: 10, cursor: 'ns-resize', flexShrink: 0 }}
                onPointerDown={handleResizeStart}
              >
                <div
                  style={{
                    width: 32,
                    height: 3,
                    borderRadius: 2,
                    background: isDragging ? colors.accent : colors.containerBorder,
                    transition: isDragging ? 'none' : 'background 0.15s',
                  }}
                />
              </div>
            )}
          </motion.div>

          {/* ─── Input row — circles float outside left ─── */}
          <div
            data-clui-ui
            className="relative"
            style={{
              minHeight: 46,
              zIndex: 15,
              ...(isTop ? { marginTop: 10 } : { marginBottom: 10 }),
              order: isTop ? 1 : 2,
            }}
          >
            {/* Stacked circle buttons — expand on hover */}
            <div
              data-clui-ui
              className="circles-out"
            >
              <div className="btn-stack">
                {/* btn-1: Attach (front, rightmost) */}
                <button
                  className="stack-btn stack-btn-1 glass-surface"
                  title="Attach file"
                  onClick={handleAttachFile}
                  disabled={isRunning}
                >
                  <Paperclip size={17} />
                </button>
                {/* btn-2: Screenshot (middle) */}
                <button
                  className="stack-btn stack-btn-2 glass-surface"
                  title="Take screenshot"
                  onClick={handleScreenshot}
                  disabled={isRunning}
                >
                  <Camera size={17} />
                </button>
                {/* btn-3: Skills (back, leftmost) */}
                <button
                  className="stack-btn stack-btn-3 glass-surface"
                  title="Skills & Plugins"
                  onClick={() => useSessionStore.getState().toggleMarketplace()}
                  disabled={isRunning}
                >
                  <HeadCircuit size={17} />
                </button>
              </div>
            </div>

            {/* Input pill */}
            <div
              data-clui-ui
              className="glass-surface w-full"
              style={{ minHeight: 50, borderRadius: 25, padding: '0 6px 0 16px', background: colors.inputPillBg }}
            >
              <InputBar />
            </div>
          </div>
        </div>
      </div>
    </PopoverLayerProvider>
  )
}
