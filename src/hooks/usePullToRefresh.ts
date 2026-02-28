import { useRef, useCallback, useEffect } from 'react';

const THRESHOLD = 72;
const MAX_PULL = 110;
const RESISTANCE = 0.45;

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const containerRef = useRef<HTMLElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const pullDistRef = useRef(0);
  const refreshingRef = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const setIndicator = useCallback((dist: number, refreshing: boolean) => {
    const el = indicatorRef.current;
    if (!el) return;
    if (refreshing) {
      el.style.transform = `translateY(${THRESHOLD}px)`;
      el.style.opacity = '1';
      el.querySelector('.ptr-spinner')?.classList.add('ptr-spin');
      el.querySelector('.ptr-arrow')?.classList.add('ptr-arrow-hidden');
    } else if (dist <= 0) {
      el.style.transform = 'translateY(-60px)';
      el.style.opacity = '0';
      el.querySelector('.ptr-spinner')?.classList.remove('ptr-spin');
      el.querySelector('.ptr-arrow')?.classList.remove('ptr-arrow-hidden');
    } else {
      const progress = Math.min(dist / THRESHOLD, 1);
      el.style.transform = `translateY(${dist - 48}px)`;
      el.style.opacity = String(progress);
      const arrow = el.querySelector('.ptr-arrow') as HTMLElement | null;
      if (arrow) arrow.style.transform = `rotate(${progress * 180}deg)`;
    }
  }, []);

  const onTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || refreshingRef.current) return;
    if (container.scrollTop > 0) return;
    startYRef.current = e.touches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (startYRef.current === null || refreshingRef.current) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      startYRef.current = null;
      return;
    }
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) return;
    pullDistRef.current = Math.min(dy * RESISTANCE, MAX_PULL);
    setIndicator(pullDistRef.current, false);
    if (pullDistRef.current > 8) e.preventDefault();
  }, [setIndicator]);

  const onTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    if (refreshingRef.current) return;
    const dist = pullDistRef.current;
    pullDistRef.current = 0;
    if (dist >= THRESHOLD) {
      refreshingRef.current = true;
      setIndicator(0, true);
      try {
        await onRefresh();
      } finally {
        refreshingRef.current = false;
        setIndicator(0, false);
      }
    } else {
      setIndicator(0, false);
    }
  }, [onRefresh, setIndicator]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  return { containerRef, indicatorRef };
}
