"use client";

import { useState, useCallback } from "react";
import { Row, IconButton, RevealFx } from "@once-ui-system/core";
import { AnimatePresence, motion } from "framer-motion";

interface ChartCarouselProps {
  views: Array<{
    id: string;
    label: string;
    content: React.ReactNode;
  }>;
}

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -300 : 300,
    opacity: 0,
  }),
};

export function ChartCarousel({ views }: ChartCarouselProps) {
  const [[current, dir], setState] = useState([0, 0]);

  const goTo = useCallback(
    (next: number) => {
      setState([next, next > current ? 1 : -1]);
    },
    [current]
  );

  const prev = () => goTo(current === 0 ? views.length - 1 : current - 1);
  const next = () => goTo(current === views.length - 1 ? 0 : current + 1);

  if (views.length === 0) return null;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={views[current].id}
          custom={dir}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ width: "100%" }}
        >
          {views[current].content}
        </motion.div>
      </AnimatePresence>

      <Row gap="12" horizontal="center" paddingY="16">
        <IconButton
          icon="chevronLeft"
          onClick={prev}
          size="s"
          variant="tertiary"
          tooltip="Anterior"
        />
        {views.map((v, i) => (
          <div
            key={v.id}
            onClick={() => goTo(i)}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: i === current
                ? "var(--brand-background-strong)"
                : "var(--neutral-alpha-medium)",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          />
        ))}
        <IconButton
          icon="chevronRight"
          onClick={next}
          size="s"
          variant="tertiary"
          tooltip="Siguiente"
        />
      </Row>
    </div>
  );
}
