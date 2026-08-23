import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initialValue;
      const parsed = JSON.parse(raw) as T;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && initialValue && typeof initialValue === "object" && !Array.isArray(initialValue)) {
        return { ...initialValue, ...parsed };
      }
      return parsed;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
