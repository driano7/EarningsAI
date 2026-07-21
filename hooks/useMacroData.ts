"use client";

import { useState, useEffect } from "react";
import type { MacroSerie } from "@/lib/macro";

interface MacroState {
  data: MacroSerie[] | null;
  loading: boolean;
  error: string | null;
}

export function useMacroData(): MacroState {
  const [state, setState] = useState<MacroState>({ data: null, loading: true, error: null });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/macro");
        if (!res.ok) throw new Error("FRED unavailable");
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setState({ data: json as MacroSerie[], loading: false, error: null });
      } catch (e) {
        setState({ data: null, loading: false, error: (e as Error).message });
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return state;
}
