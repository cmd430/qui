/*
 * Copyright (c) 2025, s0up and the autobrr contributors.
 * SPDX-License-Identifier: MIT
 */

import { useRef, useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DraggableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

export function DraggableDialog({ 
  open, 
  onOpenChange, 
  children, 
  className
}: DraggableDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)

  // Ensure we only render on client side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset position when dialog opens
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 })
    }
  }, [open])

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    // Only start dragging if clicking on the header area
    const target = e.target as HTMLElement
    if (!target.closest('[data-draggable-handle]')) return

    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
    e.preventDefault()
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart])

  // Handle escape key
  useEffect(() => {
    if (!open) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  if (!mounted || !open) return null

  const dialogContent = (
    <>
      {/* Slight backdrop for z-index layering - adjust opacity as needed */}
      <div 
        className="fixed inset-0 bg-black/20" 
        style={{ zIndex: 9999 }}
        onClick={() => onOpenChange(false)}
      />
      
      {/* Dialog content */}
      <div
        ref={dialogRef}
        className={cn(
          "fixed grid w-full max-w-lg gap-0 border bg-background p-0 shadow-lg rounded-lg",
          "left-1/2 top-1/2",
          isDragging && "cursor-grabbing select-none",
          className
        )}
        style={{
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          zIndex: 10000
        }}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>
    </>
  )

  // Render as portal to ensure it's at document body level
  return createPortal(dialogContent, document.body)
}

export function DraggableDialogHandle({ 
  children, 
  className 
}: { 
  children: React.ReactNode
  className?: string 
}) {
  return (
    <div 
      data-draggable-handle
      className={cn(
        "cursor-grab active:cursor-grabbing select-none",
        className
      )}
    >
      {children}
    </div>
  )
}