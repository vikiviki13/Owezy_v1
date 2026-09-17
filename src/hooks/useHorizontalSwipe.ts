// Reusable horizontal swipe gesture detection built on Pointer Events.
//
// - Touch pointers only: mouse drags on desktop never navigate.
// - The gesture must be clearly horizontal: |dx| must exceed |dy| by a fixed
//   ratio before the gesture is locked in, so vertical scrolling is untouched.
// - A quick flick counts with a shorter distance; tiny movements never do.
// - Gestures starting inside form controls, dialogs, menus, or elements
//   marked data-no-swipe are ignored (overlays get gesture priority).
// - When the browser takes over scrolling (pointercancel), tracking stops, so
//   nested horizontal scrollables keep working without any touch-action hacks.

import { useEffect, useRef } from 'react';

const SWIPE_THRESHOLD_PX = 48;
const SWIPE_QUICK_THRESHOLD_PX = 32;
const SWIPE_QUICK_MAX_MS = 260;
const AXIS_RATIO = 1.5;
const AXIS_LOCK_PX = 16;
const CLICK_SUPPRESS_MS = 350;

const BLOCKED_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[data-no-swipe]',
].join(', ');

export interface HorizontalSwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function useHorizontalSwipe(handlers: HorizontalSwipeHandlers, enabled: boolean) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;
    let horizontal = false;
    let suppressClickUntil = 0;

    function isBlocked(target: EventTarget | null) {
      return target instanceof Element && Boolean(target.closest(BLOCKED_SELECTOR));
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType !== 'touch') return;
      if (isBlocked(event.target)) return;
      tracking = true;
      horizontal = false;
      startX = event.clientX;
      startY = event.clientY;
      startTime = performance.now();
    }

    function onPointerMove(event: PointerEvent) {
      if (!tracking) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > absDy * AXIS_RATIO && absDx >= AXIS_LOCK_PX) {
        // Clearly horizontal: cancel the move so the element underneath does
        // not also fire a click when the swipe ends.
        horizontal = true;
        event.preventDefault();
      } else if (absDy > absDx * AXIS_RATIO && absDy >= AXIS_LOCK_PX) {
        // Clearly vertical: hand the gesture back to normal scrolling.
        tracking = false;
      }
    }

    function finish(event: PointerEvent) {
      if (!tracking) return;
      tracking = false;
      if (!horizontal) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) <= Math.abs(dy) * AXIS_RATIO) return;
      const duration = performance.now() - startTime;
      const threshold = duration < SWIPE_QUICK_MAX_MS ? SWIPE_QUICK_THRESHOLD_PX : SWIPE_THRESHOLD_PX;
      if (Math.abs(dx) < threshold) return;
      suppressClickUntil = performance.now() + CLICK_SUPPRESS_MS;
      if (dx < 0) handlersRef.current.onSwipeLeft?.();
      else handlersRef.current.onSwipeRight?.();
    }

    function onPointerCancel() {
      tracking = false;
    }

    // Safety net: suppress the click that some browsers still fire after a
    // drag ends, so a swipe over a card never opens the card as well.
    function onClick(event: MouseEvent) {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('click', onClick, true);
    };
  }, [enabled]);
}