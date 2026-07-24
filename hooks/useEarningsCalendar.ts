/*
 * Quartly Bot — hooks/useEarningsCalendar.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect } from "react";

export interface CalendarEarningsTicker {
  ticker: string;
  name: string;
  logo: string | null;
  estimate: number;
  hour?: string;
}

export interface CalendarEarningsDay {
  date: string;
  tickers: CalendarEarningsTicker[];
  fetchedAt: number;
}

export function useEarningsCalendar(year: number, month: number) {
  const [days, setDays] = useState<CalendarEarningsDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/earnings-calendar?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDays(data.days || []);
      })
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [year, month]);

  const dateMap = new Map<string, CalendarEarningsTicker[]>();
  for (const day of days) {
    dateMap.set(day.date, day.tickers);
  }

  return { days, dateMap, loading };
}
