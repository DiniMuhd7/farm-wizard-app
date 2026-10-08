import { useEffect, useRef, useState } from "react";

export const useThrottle = (fn: (...args: any[]) => void, limit: number) => {
  const lastRun = useRef(0);

  return (...args: any[]) => {
    const now = Date.now();
    if (now - lastRun.current >= limit) {
      lastRun.current = now;
      fn(...args);
    }
  };
};

/*

export const useThrottleWithState = (
  fn: (...args: any[]) => void,
  limit: number
) => {
  const lastRun = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isThrottled, setIsThrottled] = useState(false);

  const throttledFn = (...args: any[]) => {
    const now = Date.now();
    if (now - lastRun.current >= limit) {
      lastRun.current = now;
      setIsThrottled(true);
      fn(...args);
      timeout.current = setTimeout(() => {
        setIsThrottled(false);
      }, limit);
    }
  };

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  return [throttledFn, isThrottled] as const;
};
// Wrap in throttle (once every 1 second)
  const [throttledTriggerSpray, isThrottledS] = useThrottleWithState(
    triggerSpray,
    1000
  );*/

// import { throttle } from "lodash";

// const triggerSprayThrottled = useMemo(
//   () => throttle(triggerSpray, 1000),
//   [triggerSpray]
// );

// // Usage in button
// <Button onPress={triggerSprayThrottled}>Spray</Button>;

/* another method
const getThrottleDelay = (userLevel: number, pesticideQty: number): number => {
  if (userLevel >= 5) return 500; // High level, fast access
  if (pesticideQty <= 2) return 2000; // Low inventory, slow down
  return 1000; // Default
};
in the components
const [throttledFn, setThrottledFn] = useState<(() => void) | null>(null);
const [isThrottled, setIsThrottled] = useState(false);

useEffect(() => {
  const delay = getThrottleDelay(userLevel, userInventory.pesticideQty);
  const [fn, throttled] = useThrottleWithState(triggerSpray, delay);
  setThrottledFn(() => fn);
  setIsThrottled(throttled);
}, [userLevel, userInventory.pesticideQty]);

update the useThrottle
const useThrottleWithState = (
  fn: (...args: any[]) => void,
  limit: number
): [() => void, boolean] => {
  const lastRun = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isThrottled, setIsThrottled] = useState(false);

  const throttledFn = useCallback((...args: any[]) => {
    const now = Date.now();
    if (now - lastRun.current >= limit) {
      lastRun.current = now;
      setIsThrottled(true);
      fn(...args);
      timeout.current = setTimeout(() => {
        setIsThrottled(false);
      }, limit);
    }
  }, [fn, limit]);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  return [throttledFn, isThrottled];
};
use in button
<Button
  onPress={throttledFn || (() => {})}
  disabled={isThrottled || !throttledFn}
  title={isThrottled ? "Please wait..." : "Spray"}
/>

*/
