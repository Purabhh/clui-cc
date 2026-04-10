import React, { useState } from 'react'
import { X } from '@phosphor-icons/react'
import { useColors } from '../theme'

/**
 * Motion-button inspired slide-to-close.
 * A small red circle that expands on hover to reveal "Close" text.
 * Clicking it hides the CLUI window.
 */
export function SlideCloseButton() {
  const colors = useColors()
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => window.clui.hideWindow()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center rounded-full overflow-hidden no-drag"
      style={{
        height: 22,
        width: hovered ? 62 : 22,
        cursor: 'pointer',
        border: 'none',
        padding: 0,
        background: colors.statusError,
        opacity: hovered ? 0.95 : 0.7,
        transition: 'width 0.3s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.2s ease',
      }}
      title="Hide window"
    >
      {/* X icon — always visible, nudges right on expand */}
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 22,
          height: 22,
          transform: hovered ? 'translateX(2px)' : 'translateX(0)',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.3, 0.64, 1)',
        }}
      >
        <X size={10} weight="bold" style={{ color: '#fff' }} />
      </span>

      {/* "Close" label — slides in on hover */}
      <span
        className="text-[10px] font-medium whitespace-nowrap"
        style={{
          color: '#fff',
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateX(0)' : 'translateX(-4px)',
          transition: 'opacity 0.2s ease 0.05s, transform 0.3s cubic-bezier(0.34, 1.3, 0.64, 1)',
          paddingRight: 8,
        }}
      >
        Close
      </span>
    </button>
  )
}
