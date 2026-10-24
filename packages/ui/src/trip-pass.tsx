import { useEffect, useState, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
export function TripPass({
  code,
  status,
  children,
  className = '',
}: {
  code: string;
  status: string;
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion(),
    [separate, setSeparate] = useState(false),
    previous = useRef(status);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem('trip-status:' + code);
      sessionStorage.setItem('trip-status:' + code, status);
    } catch {}
    if (
      status === 'confirmed' &&
      ((saved && saved !== 'confirmed') || previous.current !== 'confirmed')
    ) {
      setSeparate(true);
      const timer = setTimeout(() => setSeparate(false), 300);
      previous.current = status;
      return () => clearTimeout(timer);
    }
    previous.current = status;
  }, [code, status]);
  return (
    <motion.div
      className={`trip-pass ${className} ${separate ? 'confirmation-separation' : ''}`}
      initial={false}
      animate={separate && !reduced ? { x: [0, 6, 0] } : { x: 0 }}
      transition={{ duration: reduced ? 0 : 0.3 }}
    >
      {children}
    </motion.div>
  );
}
