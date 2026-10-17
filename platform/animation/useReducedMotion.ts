import { useEffect, useState } from "react";

const query = "(prefers-reduced-motion: reduce)";
const getPreference = () => typeof window !== "undefined" && typeof window.matchMedia === "function"
  ? window.matchMedia(query).matches : true;

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(getPreference);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setReduceMotion(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  return reduceMotion;
}
