import { motion, useAnimationControls } from 'framer-motion';
import { memo, useEffect, useId, useState } from 'react';

export type PipMood = 'idle' | 'happy' | 'surprised' | 'worried' | 'cheer' | 'sad';

const MOTIONS: Record<PipMood, { y?: number[]; x?: number[]; rotate?: number[]; duration: number; repeat?: number }> = {
  idle: { y: [0, -2, 0], duration: 0.4 },
  happy: { y: [0, -5, 0], duration: 0.45 },
  surprised: { y: [0, -6, 0], duration: 0.4 },
  worried: { rotate: [0, -3, 3, 0], duration: 0.5 },
  cheer: { y: [0, -8, 0, -4, 0], duration: 0.8 },
  sad: { y: [0, 2, 0], rotate: [0, -4, -3], duration: 0.6 },
};

/** Pip the pawn — the app's mascot. `pulse` changes retrigger the reaction animation. */
function PipImpl({ mood, pulse, size = 48 }: { mood: PipMood; pulse: number; size?: number }) {
  const ctl = useAnimationControls();
  const gid = useId().replace(/:/g, '');
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const m = MOTIONS[mood];
    const { duration, repeat, ...frames } = m;
    void ctl.start({ ...frames, transition: { duration, repeat: repeat ?? 0, ease: 'easeInOut' } });
  }, [mood, pulse, ctl]);

  useEffect(() => {
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        loop();
      }, 2400 + Math.random() * 2400);
    };
    loop();
    return () => window.clearTimeout(t);
  }, []);

  const eyesHappy = mood === 'happy' || mood === 'cheer';
  const armsUp = mood === 'cheer' ? 100 : mood === 'happy' ? 30 : mood === 'surprised' ? 45 : 0;

  return (
    <motion.div className="pip" style={{ width: size, height: size * (140 / 120), originY: 1 }} animate={ctl}>
      <svg viewBox="0 0 120 140" width="100%" height="100%" aria-hidden overflow="visible">
        <defs>
          <linearGradient id={`pb${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFA449" />
            <stop offset="1" stopColor="#F07A12" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="134" rx="38" ry="5" fill="rgba(59,51,85,.18)" />
        <motion.rect x="14" y="78" width="20" height="11" rx="5.5" fill="#F07A12" style={{ originX: '100%', originY: '20%' }} animate={{ rotate: armsUp }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} />
        <motion.rect x="86" y="78" width="20" height="11" rx="5.5" fill="#F07A12" style={{ originX: '0%', originY: '20%' }} animate={{ rotate: -armsUp }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} />
        <path d="M24 130 C24 118 32 112 40 108 C34 100 34 92 38 86 L82 86 C86 92 86 100 80 108 C88 112 96 118 96 130 Z" fill={`url(#pb${gid})`} />
        <rect x="30" y="80" width="60" height="12" rx="6" fill="#D9670A" />
        <circle cx="60" cy="50" r="38" fill={`url(#pb${gid})`} />
        <ellipse cx="48" cy="26" rx="12" ry="6" fill="rgba(255,255,255,.35)" transform="rotate(-20 48 26)" />
        <ellipse cx="34" cy="62" rx="7" ry="4.5" fill="#FF6F8E" opacity={mood === 'sad' ? 0.25 : 0.55} />
        <ellipse cx="86" cy="62" rx="7" ry="4.5" fill="#FF6F8E" opacity={mood === 'sad' ? 0.25 : 0.55} />
        {eyesHappy ? (
          <g fill="none" stroke="#3B3355" strokeWidth="4.5" strokeLinecap="round">
            <path d="M38 52 Q46 40 54 52" />
            <path d="M66 52 Q74 40 82 52" />
          </g>
        ) : (
          <g>
            {[46, 74].map((cx) => (
              <g key={cx}>
                <motion.ellipse cx={cx} cy="48" rx="10" ry="12" fill="#fff" animate={{ scale: mood === 'surprised' ? 1.2 : 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} />
                <motion.circle cx={cx + 1.5} cy={mood === 'sad' ? 53 : 50} r="6" fill="#3B3355" animate={{ scale: mood === 'surprised' ? 0.7 : 1 }} />
                <circle cx={cx + 3.5} cy={mood === 'sad' ? 50 : 47} r="2" fill="#fff" />
                <motion.rect x={cx - 11} y="35" width="22" height="26" rx="10" fill="#F98C2B" style={{ originY: 0 }} initial={false} animate={{ scaleY: blink ? 1 : 0 }} transition={{ duration: 0.07 }} />
              </g>
            ))}
          </g>
        )}
        {(mood === 'worried' || mood === 'sad') && (
          <g fill="none" stroke="#3B3355" strokeWidth="4" strokeLinecap="round">
            <path d="M37 33 L54 38" />
            <path d="M83 33 L66 38" />
          </g>
        )}
        {mood === 'surprised' || mood === 'cheer' ? (
          <motion.ellipse cx="60" cy="72" rx="7" ry="8" fill="#3B3355" initial={{ scale: 0 }} animate={{ scale: 1 }} />
        ) : mood === 'worried' ? (
          <path d="M50 74 Q55 68 60 72 Q65 76 70 70" fill="none" stroke="#3B3355" strokeWidth="4" strokeLinecap="round" />
        ) : mood === 'sad' ? (
          <path d="M50 74 Q60 66 70 74" fill="none" stroke="#3B3355" strokeWidth="4.5" strokeLinecap="round" />
        ) : (
          <path d="M50 68 Q60 78 70 68" fill="none" stroke="#3B3355" strokeWidth="4.5" strokeLinecap="round" />
        )}
      </svg>
    </motion.div>
  );
}

export const Pip = memo(PipImpl);
