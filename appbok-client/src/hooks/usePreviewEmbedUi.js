import { useEffect } from 'react';

function previewEmbedActive() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview_embed') === '1';
}

function shouldIgnoreDragStart(target) {
  if (!target || target.nodeType !== 1) return true;
  return Boolean(
    target.closest(
      [
        'button',
        'a',
        'input',
        'textarea',
        'select',
        'option',
        'label',
        '[role="button"]',
        '[contenteditable="true"]',
        '.booking-modal-overlay',
        '.booking-modal-sheet',
        '.desktop-header-btn',
      ].join(', '),
    ),
  );
}

/**
 * Admin iframe-preview: göm scrollbars, grab/grabbing, pekare-drag för scroll.
 * Pointer capture aktiveras först efter liten rörelse så klick på tjänstkort m.m. fungerar.
 */
export function usePreviewEmbedUi() {
  useEffect(() => {
    if (!previewEmbedActive()) return;

    const root = document.documentElement;
    root.classList.add('preview-embed-mode');

    let armed = false;
    let startY = 0;
    let lastY = 0;
    let moved = false;
    let captureId = null;

    const releaseCapture = () => {
      if (captureId == null) return;
      try {
        document.body.releasePointerCapture(captureId);
      } catch {
        /* ignore */
      }
      captureId = null;
    };

    const endDrag = () => {
      if (!armed) return;
      armed = false;
      root.classList.remove('preview-embed-dragging');
      releaseCapture();
      if (moved) {
        const swallowClick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          document.removeEventListener('click', swallowClick, true);
        };
        document.addEventListener('click', swallowClick, true);
        window.setTimeout(() => document.removeEventListener('click', swallowClick, true), 80);
      }
      moved = false;
    };

    const onPointerDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (shouldIgnoreDragStart(e.target)) return;
      armed = true;
      startY = e.clientY;
      lastY = e.clientY;
      moved = false;
    };

    const onPointerMove = (e) => {
      if (!armed) return;
      if (Math.abs(e.clientY - startY) < 6) return;
      if (captureId === null) {
        try {
          document.body.setPointerCapture(e.pointerId);
          captureId = e.pointerId;
        } catch {
          /* ignore */
        }
      }
      if (!moved) moved = true;
      root.classList.add('preview-embed-dragging');
      const step = e.clientY - lastY;
      lastY = e.clientY;
      window.scrollBy({ top: -step, left: 0, behavior: 'auto' });
    };

    const onPointerUp = () => {
      endDrag();
    };

    const onPointerCancel = () => {
      endDrag();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerCancel);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerCancel);
      releaseCapture();
      root.classList.remove('preview-embed-mode', 'preview-embed-dragging');
    };
  }, []);
}
