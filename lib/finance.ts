import {
  getFinanceTransactions,
  addFinanceTransaction,
  getUserCategories,
  FinanceTransaction,
} from "./kv";

export interface MonthlySummary {
  mes: string;
  ingresos: number;
  gastos: number;
  inversiones: number;
  balance: number;
  porCategoria: Array<{ icon: string; categoria: string; total: number; porcentaje: number }>;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Salario": "💼",
  "Freelance": "💻",
  "Inversiones": "📈",
  "Ventas": "🛒",
  "Otros ingresos": "💰",
  "Comida": "🍔",
  "Renta": "🏠",
  "Transporte": "🚗",
  "Entretenimiento": "🎬",
  "Salud": "🏥",
  "Educación": "📚",
  "Servicios": "💡",
  "Compras": "🛍️",
  "Otros gastos": "💸",
};

function getCategoryIcon(cat: string): string {
  return CATEGORY_ICONS[cat] || "📌";
}

export async function getSummary(chatId: string, mes?: string): Promise<MonthlySummary | null> {
  const txns = await getFinanceTransactions(chatId);
  if (txns.length === 0) return null;

  const targetMonth = mes || new Date().toISOString().slice(0, 7);

  const filtered = txns.filter((t) => t.date.startsWith(targetMonth));
  if (filtered.length === 0) return null;

  let ingresos = 0;
  let gastos = 0;
  let inversiones = 0;
  const catTotals: Record<string, number> = {};

  for (const t of filtered) {
    if (t.type === "income") {
      ingresos += t.amount;
    } else if (t.type === "expense") {
      gastos += t.amount;
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    } else if (t.type === "invest") {
      inversiones += t.amount;
    }
  }

  const totalGastos = gastos;
  const porCategoria = Object.entries(catTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([categoria, total]) => ({
      icon: getCategoryIcon(categoria),
      categoria,
      total,
      porcentaje: totalGastos > 0 ? (total / totalGastos) * 100 : 0,
    }));

  return {
    mes: targetMonth,
    ingresos,
    gastos,
    inversiones,
    balance: ingresos - gastos - inversiones,
    porCategoria,
  };
}

export async function addTransaction(
  chatId: string,
  type: "income" | "expense" | "invest",
  amount: number,
  category: string,
  description: string
): Promise<FinanceTransaction> {
  const txn: FinanceTransaction = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    amount: Math.round(amount * 100) / 100,
    category,
    description,
    date: new Date().toISOString().slice(0, 10),
    createdAt: Date.now(),
  };

  await addFinanceTransaction(chatId, txn);
  return txn;
}

export function formatSummary(summary: MonthlySummary): string {
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const [year, monthNum] = summary.mes.split("-");
  const monthName = monthNames[parseInt(monthNum, 10) - 1] || summary.mes;

  let msg = `📊 *Resumen ${monthName} ${year}*
  
💰 Ingresos: $${summary.ingresos.toLocaleString()}
💸 Gastos: $${summary.gastos.toLocaleString()}
📈 Inversiones: $${summary.inversiones.toLocaleString()}
💵 Balance: $${summary.balance.toLocaleString()}
`;

  if (summary.porCategoria.length > 0) {
    msg += `\n*Por categoría:*\n`;
    for (const cat of summary.porCategoria) {
      msg += `${cat.icon} ${cat.categoria}: $${cat.total.toLocaleString()} (${cat.porcentaje.toFixed(0)}%)\n`;
    }
  }

  return msg;
}

export function formatSummaryShort(summary: MonthlySummary): string {
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const [year, monthNum] = summary.mes.split("-");
  const monthName = monthNames[parseInt(monthNum, 10) - 1] || summary.mes;
  return `📊 ${monthName} ${year}: +$${summary.ingresos.toLocaleString()} / -$${summary.gastos.toLocaleString()} / 📈 $${summary.inversiones.toLocaleString()} = 💵 $${summary.balance.toLocaleString()}`;
}

export function generateCSV(chatId: string, txns: FinanceTransaction[]): string {
  const header = "id,tipo,cantidad,categoria,descripcion,fecha";
  const rows = txns.map((t) =>
    [t.id, t.type, t.amount, t.category, `"${t.description.replace(/"/g, '""')}"`, t.date].join(",")
  );
  return [header, ...rows].join("\n");
}
