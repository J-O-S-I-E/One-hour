"use client";

import { useState } from "react";

export type Origin = { lat: number; lng: number } | null;

/** Optional precise location; null means "use my campus center". */
export function useOrigin() {
  const [origin, setOrigin] = useState<Origin>(null);
  const [status, setStatus] = useState<"campus" | "locating" | "precise" | "denied">("campus");

  function locate() {
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("precise");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }

  function resetToCampus() {
    setOrigin(null);
    setStatus("campus");
  }

  return { origin, status, locate, resetToCampus };
}
