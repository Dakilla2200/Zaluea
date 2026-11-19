import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './styles.css';
import { MotionConfig } from 'framer-motion';
import App from './App';

// Block pinch-zoom / double-tap zoom gestures that iOS Safari ignores in the viewport meta.
const stop = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', stop, { passive: false });
document.addEventListener('gesturechange', stop, { passive: false });
document.addEventListener('dblclick', stop, { passive: false });
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) return e.preventDefault();
    // allow scrolling only inside scrollable sheets
    const el = e.target as HTMLElement | null;
    if (!el?.closest('.sheet-body, .moves')) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener('contextmenu', stop);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
