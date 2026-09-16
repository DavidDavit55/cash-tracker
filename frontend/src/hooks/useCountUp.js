import { useEffect, useRef, useState } from 'react';

export function useCountUp(target, durationMs = 800) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    startRef.current = null;
    let frameId;
    const step = (timestamp) => {
      if (startRef.current === null) startRef.current = timestamp;
      const progress = Math.min(1, (timestamp - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      setValue(Math.round(target * eased));
      if (progress < 1) frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, durationMs]);

  return value;
}
