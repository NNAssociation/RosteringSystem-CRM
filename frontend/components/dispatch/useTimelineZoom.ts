"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { anchoredTimelineScroll, clampTimelineZoom } from "@/lib/dispatch-timeline";

export function useTimelineZoom(ready: boolean, labelWidth: number, baseWidth: number) {
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [availableWidth, setAvailableWidth] = useState(0);
  const minimumZoom = availableWidth > 0 ? availableWidth / baseWidth : 0.5;
  const maximumZoom = 5;
  const effectiveZoom = Math.max(zoom, minimumZoom);
  const current = useRef(1);
  const pendingScroll = useRef<number | null>(null);

  const changeZoom = useCallback((value: number, pointerX?: number) => {
    const element = viewport.current;
    const next = clampTimelineZoom(value, minimumZoom, maximumZoom);
    if (!element || Math.abs(next - current.current) < 0.001) return;
    const anchor = Math.max(labelWidth, pointerX ?? (element.clientWidth + labelWidth) / 2);
    pendingScroll.current = anchoredTimelineScroll(
      pendingScroll.current ?? element.scrollLeft,
      anchor,
      labelWidth,
      current.current,
      next
    );
    current.current = next;
    setZoom(next);
  }, [labelWidth, minimumZoom, maximumZoom]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !ready) return;
    const measure = () => setAvailableWidth(Math.max(1, element.clientWidth - labelWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ready, labelWidth]);

  useLayoutEffect(() => {
    current.current = effectiveZoom;
  }, [effectiveZoom]);

  useLayoutEffect(() => {
    if (viewport.current && pendingScroll.current !== null) {
      viewport.current.scrollLeft = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [effectiveZoom]);

  // Trackpad pinch-to-zoom, mousepad expand, touch gestures, and Ctrl/Alt + wheel
  useEffect(() => {
    const element = viewport.current;
    if (!element || !ready) return;

    // 1. Wheel handler: Precision touchpads send Ctrl+wheel for pinch/expand gestures
    const handleWheel = (event: WheelEvent) => {
      // Support standard trackpad pinch (ctrlKey) or mouse wheel with Ctrl / Alt
      if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
      event.preventDefault();

      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      // Smooth logarithmic scale: negative delta = expand/zoom in, positive delta = pinch/zoom out
      const clampedDelta = Math.max(-80, Math.min(80, delta));
      const factor = Math.exp(-clampedDelta * 0.006);
      const pointerX = event.clientX - element.getBoundingClientRect().left;

      changeZoom(current.current * factor, pointerX);
    };

    // 2. Safari / WebKit native gesture support (Mac / iOS)
    let gestureInitialZoom = 1;
    const handleGestureStart = (event: any) => {
      event.preventDefault();
      gestureInitialZoom = current.current;
    };
    const handleGestureChange = (event: any) => {
      event.preventDefault();
      const pointerX = event.clientX - element.getBoundingClientRect().left;
      changeZoom(gestureInitialZoom * event.scale, pointerX);
    };

    // 3. Multi-touch support for touchscreens / 2-finger touch expansion
    let initialTouchDist = 0;
    let initialTouchZoom = 1;
    let touchAnchorX = 0;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        initialTouchDist = Math.hypot(dx, dy);
        touchAnchorX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - element.getBoundingClientRect().left;
        initialTouchZoom = current.current;
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 2 && initialTouchDist > 0) {
        event.preventDefault();
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const factor = currentDist / initialTouchDist;
        changeZoom(initialTouchZoom * factor, touchAnchorX);
      }
    };

    const handleTouchEnd = () => {
      initialTouchDist = 0;
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    element.addEventListener("gesturestart", handleGestureStart as any, { passive: false });
    element.addEventListener("gesturechange", handleGestureChange as any, { passive: false });
    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("wheel", handleWheel);
      element.removeEventListener("gesturestart", handleGestureStart as any);
      element.removeEventListener("gesturechange", handleGestureChange as any);
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ready, changeZoom]);

  const zoomIn = useCallback(() => changeZoom(current.current * 1.3), [changeZoom]);
  const zoomOut = useCallback(() => changeZoom(current.current / 1.3), [changeZoom]);
  const resetZoom = useCallback(() => changeZoom(1), [changeZoom]);
  const fit = useCallback(() => changeZoom(minimumZoom), [changeZoom, minimumZoom]);
  const focus15m = useCallback(() => changeZoom(Math.max(2.2, current.current)), [changeZoom]);

  return {
    viewport,
    zoom: effectiveZoom,
    minimumZoom,
    maximumZoom,
    availableWidth,
    changeZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fit,
    focus15m,
  };
}
