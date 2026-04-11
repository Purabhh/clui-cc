import React, { useRef } from 'react'
import { AnimatePresence, Reorder } from 'framer-motion'
import { Plus, X, PushPin } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { HistoryPicker } from './HistoryPicker'
import { SettingsPopover } from './SettingsPopover'
import { SlideCloseButton } from './SlideCloseButton'
import { useColors } from '../theme'
import type { TabStatus, TabState } from '../../shared/types'

function StatusDot({ status, hasUnread, hasPermission }: { status: TabStatus; hasUnread: boolean; hasPermission: boolean }) {
  const colors = useColors()
  let bg: string = colors.statusIdle
  let pulse = false
  let glow = false

  if (status === 'dead' || status === 'failed') {
    bg = colors.statusError
  } else if (hasPermission) {
    bg = colors.statusPermission
    glow = true
  } else if (status === 'connecting' || status === 'running') {
    bg = colors.statusRunning
    pulse = true
  } else if (hasUnread) {
    bg = colors.statusComplete
  }

  return (
    <span
      className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${pulse ? 'animate-pulse-dot' : ''}`}
      style={{
        background: bg,
        ...(glow ? { boxShadow: `0 0 6px 2px ${colors.statusPermissionGlow}` } : {}),
      }}
    />
  )
}

function TabItem({
  tab,
  isActive,
  tabCount,
}: {
  tab: TabState
  isActive: boolean
  tabCount: number
}) {
  const selectTab = useSessionStore((s) => s.selectTab)
  const closeTab = useSessionStore((s) => s.closeTab)
  const togglePinTab = useSessionStore((s) => s.togglePinTab)
  const colors = useColors()
  const dragInfo = useRef({ hasMoved: false })

  return (
    <Reorder.Item
      value={tab}
      id={tab.id}
      onDragStart={() => { dragInfo.current.hasMoved = false }}
      onDrag={() => { dragInfo.current.hasMoved = true }}
      onClick={() => {
        if (!dragInfo.current.hasMoved) selectTab(tab.id)
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="group flex items-center gap-1.5 cursor-grab active:cursor-grabbing select-none flex-shrink-0 max-w-[160px] transition-all duration-150"
      style={{
        background: isActive ? colors.tabActive : 'transparent',
        border: isActive ? `1px solid ${colors.tabActiveBorder}` : '1px solid transparent',
        borderRadius: 9999,
        padding: '4px 10px',
        fontSize: 12,
        color: isActive ? colors.textPrimary : colors.textTertiary,
        fontWeight: isActive ? 500 : 400,
      }}
      whileDrag={{
        scale: 1.05,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 50,
      }}
    >
      <StatusDot status={tab.status} hasUnread={tab.hasUnread} hasPermission={tab.permissionQueue.length > 0} />
      <span className="truncate flex-1">{tab.title}</span>
      {tab.pinned ? (
        <button
          onClick={(e) => { e.stopPropagation(); togglePinTab(tab.id) }}
          className="flex-shrink-0 rounded-full w-4 h-4 flex items-center justify-center transition-opacity"
          style={{
            opacity: isActive ? 0.7 : 0.4,
            color: colors.accent,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = isActive ? '0.7' : '0.4' }}
          title="Unpin tab"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <PushPin size={10} weight="fill" />
        </button>
      ) : tabCount > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); isActive ? togglePinTab(tab.id) : closeTab(tab.id) }}
          className="flex-shrink-0 rounded-full w-4 h-4 flex items-center justify-center transition-opacity"
          style={{
            opacity: isActive ? 0.5 : 0,
            color: colors.textSecondary,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = isActive ? '0.5' : '0' }}
          title={isActive ? 'Pin tab' : 'Close tab'}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isActive ? <PushPin size={10} /> : <X size={10} />}
        </button>
      )}
    </Reorder.Item>
  )
}

export function TabStrip() {
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const createTab = useSessionStore((s) => s.createTab)
  const reorderTabs = useSessionStore((s) => s.reorderTabs)
  const colors = useColors()

  const handleReorder = (reordered: TabState[]) => {
    // Enforce: unpinned tabs can't move left of any pinned tab
    const firstUnpinnedIdx = reordered.findIndex((t) => !t.pinned)
    const lastPinnedIdx = reordered.map((t) => t.pinned).lastIndexOf(true)

    if (firstUnpinnedIdx !== -1 && lastPinnedIdx !== -1 && firstUnpinnedIdx < lastPinnedIdx) {
      // Invalid reorder — an unpinned tab slipped before a pinned one. Reject it.
      return
    }

    reorderTabs(reordered)
  }

  return (
    <div
      data-clui-ui
      className="flex items-center no-drag"
      style={{ padding: '8px 0' }}
    >
      {/* Slide-to-close button */}
      <div className="flex-shrink-0 pl-2.5 pr-1 flex items-center">
        <SlideCloseButton />
      </div>

      {/* Scrollable tabs area — clipped by master card edge */}
      <div className="relative min-w-0 flex-1">
        <div
          className="flex items-center overflow-x-auto min-w-0"
          style={{
            scrollbarWidth: 'none',
            paddingLeft: 8,
            paddingRight: 14,
            maskImage: 'linear-gradient(to right, black 0%, black calc(100% - 40px), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black calc(100% - 40px), transparent 100%)',
          }}
        >
          <Reorder.Group
            axis="x"
            values={tabs}
            onReorder={handleReorder}
            className="flex items-center gap-1"
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
            <AnimatePresence mode="popLayout">
              {tabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  tabCount={tabs.length}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        </div>
      </div>

      {/* Pinned action buttons — always visible on the right */}
      <div className="flex items-center gap-0.5 flex-shrink-0 ml-1 pr-2">
        <button
          onClick={() => createTab()}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
          style={{ color: colors.textTertiary }}
          title="New tab"
        >
          <Plus size={14} />
        </button>

        <HistoryPicker />

        <SettingsPopover />
      </div>
    </div>
  )
}
