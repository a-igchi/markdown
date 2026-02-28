import { useState, useEffect } from "react";

export function useLocalStorage(key: string, initialValue: string): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(key) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore storage errors
    }
  }, [key, value]);

  return [value, setValue];
}
