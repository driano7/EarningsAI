"use client";

import { useEffect, useState, useMemo } from "react";
import { Column, Grid, Heading, Text, Card, Row, IconButton } from "@once-ui-system/core";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { ChartCard } from "@/components/charts/ChartCard";
import { exportCsvDownload, exportXlsxDownload } from "@/lib/chart-utils";
import { CHART_COLORS, CATEGORY_PALETTE } from "@/lib/chartColors";

interface FinanceData {
  totalIngresos: number;
  totalGastos: number;
  totalInversiones: number;
  balance: number;
  userCount: number;
  mes: string;
}

interface DailyFinance {
  date: string;
  income: number;
  expense: number;
  invest: number;
}

interface CategoryTotal {
  name: string;
  total: number;
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [daily, setDaily] = useState<DailyFinance[]>([]);
  const [categories, setCategories] = useState<CategoryTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    const pw = localStorage.getItem("quartly_auth");
    const headers = { Authorization: `Bearer ${pw}` };
    const mesQuery = selectedMonth ? `&mes=${selectedMonth}` : "";

    Promise.all([
      fetch(`/api/dashboard/finance?mes=${selectedMonth || "2026-05"}`, { headers }).then((r) => r.json()),
      fetch(`/api/dashboard/finance/chart?months=${months}`, { headers }).then((r) => r.json()),
    ])
      .then(([f, c]) => {
        if (f.ok) setData(f.finance);
        if (c.ok) {
          setDaily(c.daily || []);
          setCategories(c.categories || []);
        }
      })
      .finally(() => setLoading(false));
  }, [months, selectedMonth]);

  const monthlyData = useMemo(() => {
    const grouped: Record<string, { income: number; expense: number; invest: number }> = {};
    for (const d of daily) {
      const month = d.date.slice(0, 7);
      if (!grouped[month]) grouped[month] = { income: 0, expense: 0, invest: 0 };
      grouped[month].income += d.income;
      grouped[month].expense += d.expense;
      grouped[month].invest += d.invest;
    }
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({ month, ...vals }));
  }, [daily]);

  if (loading) return <Text>Loading...</Text>;

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const [year, monthNum] = (data?.mes || "2026-01").split("-");
  const monthName = monthNames[parseInt(monthNum, 10) - 1] || data?.mes || "";

  const statCards = [
    { label: `${monthName} ${year}`, value: `${data?.userCount || 0} usuarios activos` },
    { label: "💰 Ingresos", value: `$${(data?.totalIngresos || 0).toLocaleString()}` },
    { label: "💸 Gastos", value: `$${(data?.totalGastos || 0).toLocaleString()}` },
    { label: "📈 Inversiones", value: `$${(data?.totalInversiones || 0).toLocaleString()}` },
    { label: "💵 Balance", value: `$${(data?.balance || 0).toLocaleString()}` },
  ];

  const csvHeaders = ["Mes", "Ingresos", "Gastos", "Inversiones"];
  const csvRows = monthlyData.map((m) => [m.month, m.income, m.expense, m.invest]);

  const catHeaders = ["Categoría", "Total"];
  const catRows = categories.map((c) => [c.name, c.total]);

  return (
    <Column gap="l">
      <Column gap="s">
        <Heading variant="heading-strong-xl">Finanzas Personales</Heading>
        <Text variant="body-default-l" onBackground="neutral-weak">
          Resumen agregado de todos los usuarios
        </Text>
      </Column>

      <Grid columns="3" gap="m">
        {statCards.map((card) => (
          <Card key={card.label} padding="l" fillWidth radius="m" className="glass-card">
            <Column gap="s">
              <Text variant="body-default-s" onBackground="neutral-weak">
                {card.label}
              </Text>
              <Heading variant="display-strong-xs">{card.value}</Heading>
            </Column>
          </Card>
        ))}
      </Grid>

      <Row gap="m" vertical="center" wrap>
        {[3, 6, 12].map((m) => (
          <Card
            key={m}
            padding="xs"
            radius="m"
            className="glass-card"
            style={{ cursor: "pointer", opacity: months === m ? 1 : 0.6 }}
            onClick={() => setMonths(m)}
          >
            <Text variant="body-default-s">{m} meses</Text>
          </Card>
        ))}
        <div style={{ width: 1, height: 24, background: "var(--neutral-alpha-medium)" }} />
        {["2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12"].map((m) => (
          <Card
            key={m}
            padding="xs"
            radius="m"
            className="glass-card"
            style={{ cursor: "pointer", opacity: selectedMonth === m ? 1 : 0.4 }}
            onClick={() => setSelectedMonth(m)}
          >
            <Text variant="body-default-xs">{m}</Text>
          </Card>
        ))}
        {selectedMonth && (
          <Card padding="xs" radius="m" className="glass-card" style={{ cursor: "pointer" }}
            onClick={() => setSelectedMonth("")}>
            <Text variant="body-default-xs">✕</Text>
          </Card>
        )}
      </Row>

      <Grid columns="1" gap="m">
        <ChartCard title="Ingresos vs Gastos" subtitle="Por mes" filename="ingresos-gastos" height={720}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData.length > 0 ? monthlyData : [{ month: "Sin datos", income: 0, expense: 0, invest: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--neutral-alpha-weak)" />
              <XAxis dataKey="month" tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--neutral-on-background-weak)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "var(--neutral-alpha-weak)", border: "1px solid var(--neutral-alpha-medium)", borderRadius: 8 }}
              />
              <Legend />
              <Bar dataKey="income" fill={CHART_COLORS.positive} name="Ingresos" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill={CHART_COLORS.negative} name="Gastos" radius={[4, 4, 0, 0]} />
              <Bar dataKey="invest" fill={CHART_COLORS.neutral} name="Inversiones" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>
      <Grid columns="2" gap="m">
        <ChartCard title="Gastos por Categoría" subtitle="Distribución" filename="gastos-categoria">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories.length > 0 ? categories : [{ name: "Sin datos", total: 1 }]}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                paddingAngle={2}
              >
                {(categories.length > 0 ? categories : [{ name: "Sin datos", total: 1 }]).map((_, i) => (
                  <Cell key={`cat-${i}`} fill={CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--neutral-alpha-weak)", border: "1px solid var(--neutral-alpha-medium)", borderRadius: 8 }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </Grid>

      <Row gap="m" vertical="center" horizontal="between" padding="m" className="glass-card" radius="m">
        <Text variant="body-default-m">📊 Exportar datos financieros</Text>
        <Row gap="s">
          <IconButton
            icon="download"
            onClick={() => exportCsvDownload(csvHeaders, csvRows, "finanzas-mensual.csv")}
            size="s"
            variant="tertiary"
            tooltip="CSV Mensual"
          />
          <IconButton
            icon="download"
            onClick={() => exportXlsxDownload(csvHeaders, csvRows, "finanzas-mensual.xlsx")}
            size="s"
            variant="tertiary"
            tooltip="XLSX Mensual"
          />
          <IconButton
            icon="download"
            onClick={() => exportCsvDownload(catHeaders, catRows, "gastos-categoria.csv")}
            size="s"
            variant="tertiary"
            tooltip="CSV Categorías"
          />
        </Row>
      </Row>
    </Column>
  );
}
