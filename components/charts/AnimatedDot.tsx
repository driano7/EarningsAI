/*
 * Quartly Bot — components/charts/AnimatedDot.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { motion } from "framer-motion";

interface AnimatedDotProps {
  cx?: number;
  cy?: number;
  fill?: string;
  index?: number;
}

export function AnimatedDot({ cx, cy, fill, index }: AnimatedDotProps) {
  if (cx === undefined || cy === undefined) {
    return null;
  }

  const color = fill || "#06b6d4";

  return (
    <g>
      <motion.circle
        cx={cx}
        cy={cy}
        r={10}
        fill={color}
        opacity={0.14}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.14 }}
        transition={{ duration: 0.45, delay: (index ?? 0) * 0.06, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill={color}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.32, delay: (index ?? 0) * 0.08, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
    </g>
  );
}