/*
 * Quartly Bot — components/dashboard/TickerCard.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { useState, useEffect } from "react";
import { Column, Grid, Flex, Heading, Text, Card } from "@once-ui-system/core";
import { motion } from "framer-motion";
import PriceChange from "./PriceChange";
import AnalystSignal from "./AnalystSignal";

interface TickerPriceData {
  current: number;
  change1d: number | null;
  change1w: number | null;
  change1m: number | null;
  change3m: number | null;
  change1y: number | null;
  high52w: number | null;
  low52w: number | null;
}

interface AnalystData {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

interface TickerCardProps {
  ticker: string;
  name: string;
  sector: string;
  type: "stock" | "etf" | "crypto";
  index: number;
}

export default function TickerCard({ ticker, name, sector, type, index }: TickerCardProps) {
  const [priceData, setPriceData] = useState<TickerPriceData | null>(null);
  const [analystData, setAnalystData] = useState<AnalystData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const priceRes = await fetch(`/api/finance/price?ticker=${ticker}`);
        const priceJson = await priceRes.json();
        if (priceJson.ok) setPriceData(priceJson.data);
      } catch { /* ignore */ }

      try {
        if (type !== "etf" && type !== "crypto") {
          const recRes = await fetch(`/api/finance/recommendation?ticker=${ticker}`);
          const recJson = await recRes.json();
          if (recJson.ok) setAnalystData(recJson.data);
        }
      } catch { /* ignore */ }

      setLoading(false);
    }
    fetchData();
  }, [ticker, type]);

  const logoUrl = `https://cdn.simpleicons.org/${ticker.toLowerCase()}/white`;
  const isPositive = priceData?.change1d !== null && (priceData?.change1d ?? 0) >= 0;
  const color = priceData?.change1d === null ? "var(--neutral-on-background-weak)" : isPositive ? "var(--success-medium)" : "var(--danger-medium)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card
        padding="l"
        radius="m"
        fillWidth
        className="liquid-glass-sm"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(12px)",
        }}
      >
        {loading ? (
          <Column gap="m">
            <Flex vertical="center" gap="m">
              <Flex
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: "var(--neutral-alpha-weak)",
                }}
              />
              <Column gap="xs">
                <Flex
                  style={{
                    width: 80,
                    height: 14,
                    borderRadius: 4,
                    backgroundColor: "var(--neutral-alpha-weak)",
                  }}
                />
                <Flex
                  style={{
                    width: 120,
                    height: 12,
                    borderRadius: 4,
                    backgroundColor: "var(--neutral-alpha-weak)",
                  }}
                />
              </Column>
            </Flex>
            <Flex
              style={{
                width: "60%",
                height: 32,
                borderRadius: 4,
                backgroundColor: "var(--neutral-alpha-weak)",
              }}
            />
            <Grid columns="4" gap="s">
              {Array.from({ length: 4 }).map((_, i) => (
                <Flex
                  key={i}
                  style={{
                    height: 40,
                    borderRadius: 4,
                    backgroundColor: "var(--neutral-alpha-weak)",
                  }}
                />
              ))}
            </Grid>
          </Column>
        ) : (
          <Column gap="m">
            <Flex vertical="center" gap="m">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={ticker}
                  style={{ width: 36, height: 36, borderRadius: 8 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <Column gap="xs">
                <Heading variant="heading-strong-m">{ticker}</Heading>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  {name} — {sector}
                </Text>
              </Column>
              <Flex style={{ marginLeft: "auto" }}>
                <Text
                  variant="label-default-l"
                  style={{ color: "var(--neutral-weak)", fontSize: 10, textTransform: "uppercase" }}
                >
                  {type === "stock" ? "S&P 500" : type === "etf" ? "ETF" : "CRYPTO"}
                </Text>
              </Flex>
            </Flex>

            {priceData && (
              <Flex vertical="center" gap="s">
                <Heading variant="display-strong-xs" style={{ color }}>
                  ${priceData.current.toFixed(2)}
                </Heading>
              </Flex>
            )}

            {priceData && (
              <Grid columns="4" gap="s">
                <PriceChange value={priceData.change1d} label="1 día" />
                <PriceChange value={priceData.change1w} label="1 semana" />
                <PriceChange value={priceData.change1m} label="1 mes" />
                <PriceChange value={priceData.change3m} label="3 meses" />
              </Grid>
            )}

            {!priceData && (
              <Text variant="body-default-s" onBackground="neutral-weak">
                Sin datos de precio disponibles
              </Text>
            )}

            {analystData && (
              <Flex fillWidth>
                <AnalystSignal
                  strongBuy={analystData.strongBuy}
                  buy={analystData.buy}
                  hold={analystData.hold}
                  sell={analystData.sell}
                  strongSell={analystData.strongSell}
                />
              </Flex>
            )}
          </Column>
        )}
      </Card>
    </motion.div>
  );
}
