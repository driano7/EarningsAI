"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Column, Row, Grid, Heading, Text, Badge, Card, RevealFx,
  Button, Icon, Input, Select,
} from "@once-ui-system/core";
import { PaymentAsset, PaymentInvoice } from "@/lib/types";
import { formatCurrency } from "@/lib/formatFinance";
import {
  SUPPORTED_ASSETS,
  NETWORK_LABELS,
} from "@/lib/payment-verification";

const ASSET_OPTIONS = ["BTC", "ETH", "USDC", "USDT", "SOL"].map((a) => ({
  label: a,
  value: a,
}));

function badgeProps(status: string) {
  switch (status) {
    case "completed":
      return { background: "success-alpha-medium" as const, onBackground: "success-strong" as const, label: "Completado" };
    case "expired":
      return { background: "neutral-alpha-medium" as const, onBackground: "neutral-strong" as const, label: "Expirado" };
    case "failed":
      return { background: "danger-alpha-medium" as const, onBackground: "danger-strong" as const, label: "Fallido" };
    default:
      return { background: "warning-alpha-medium" as const, onBackground: "warning-strong" as const, label: "Pendiente" };
  }
}

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [addresses, setAddresses] = useState<Array<{ asset: string; network: string; address: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<PaymentAsset>("USDC");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDesc, setInvoiceDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatId = typeof window !== "undefined"
    ? localStorage.getItem("quartly_chatId") || "default"
    : "default";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, addrRes] = await Promise.all([
        fetch(`/api/payments/invoices?chatId=${chatId}`),
        fetch(`/api/payments/addresses?chatId=${chatId}`),
      ]);
      const invData = await invRes.json();
      const addrData = await addrRes.json();
      if (invData.ok) setInvoices(invData.invoices);
      if (addrData.ok) setAddresses(addrData.addresses);
    } catch {
      setError("Error al cargar datos de pagos");
    }
    setLoading(false);
  }, [chatId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateInvoice = async () => {
    const amount = parseFloat(invoiceAmount);
    if (isNaN(amount) || amount <= 0) return;

    setCreating(true);
    try {
      const res = await fetch(`/api/payments/invoices?chatId=${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: selectedAsset,
          amountFiat: amount,
          description: invoiceDesc || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setInvoices((prev) => [data.invoice, ...prev]);
        setInvoiceAmount("");
        setInvoiceDesc("");
      }
    } catch {
      setError("Error al crear factura");
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <Column horizontal="center" paddingY="80" gap="m">
        <Icon name="creditCard" size="l" />
        <Text variant="body-default-m" onBackground="neutral-weak">Cargando pagos...</Text>
      </Column>
    );
  }

  return (
    <Column maxWidth="l" gap="24">

      <RevealFx translateY="4">
        <Column gap="8">
          <Row gap="12" vertical="center">
            <Icon name="creditCard" size="l" />
            <Heading variant="heading-strong-xl">Pagos Crypto</Heading>
          </Row>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Aceptamos BTC (on-chain + Lightning), USDC/USDT/ETH (Ethereum, Arbitrum, Optimism, Linea, zkSync, Avalanche) y SOL
          </Text>
        </Column>
      </RevealFx>

      <Card padding="l" radius="m" fillWidth>
        <Column gap="16">
          <Heading variant="heading-strong-m">Crear Factura</Heading>
          <Grid columns="3" gap="16" fillWidth s={{ columns: 1 }}>
            <Select
              id="payment-asset"
              options={ASSET_OPTIONS}
              value={selectedAsset}
              onSelect={(v) => setSelectedAsset(v as PaymentAsset)}
              placeholder="Seleccionar activo"
            />
            <Input
              id="invoice-amount"
              label="Monto (USD)"
              type="number"
              placeholder="50.00"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
            />
            <Input
              id="invoice-desc"
              label="Descripción"
              placeholder="Pago suscripción"
              value={invoiceDesc}
              onChange={(e) => setInvoiceDesc(e.target.value)}
            />
          </Grid>
          <Button
            onClick={handleCreateInvoice}
            disabled={!invoiceAmount || creating}
          >
            {creating ? "Creando..." : "Generar Factura"}
          </Button>
          {error && (
            <Text variant="body-default-s" onBackground="danger-weak">{error}</Text>
          )}
        </Column>
      </Card>

      {/* ── SUPPORTED ASSETS ───────────────────────────── */}
      <Column gap="12">
        <Heading variant="heading-strong-m">Redes Soportadas</Heading>
        <Grid columns="4" gap="12" fillWidth l={{ columns: 2 }} s={{ columns: 1 }}>
          {SUPPORTED_ASSETS.map(({ asset, network, symbol }) => {
            const hasAddr = addresses.some(
              (a) => a.asset === asset && a.network === network
            );
            return (
              <RevealFx key={`${asset}-${network}`} translateY="4">
                <Card
                  padding="16"
                  radius="m"
                  background={hasAddr ? "surface" : "transparent"}
                  border={hasAddr ? "success-weak" : "neutral-alpha-weak"}
                >
                  <Row gap="12" vertical="center" fillWidth>
                    <Icon name={hasAddr ? "checkBadge" : "key"} size="m" onBackground={hasAddr ? "success-weak" : "neutral-weak"} />
                    <Column gap="4">
                      <Text variant="label-strong-s">{symbol}</Text>
                      <Text variant="label-default-xs" onBackground="neutral-weak">{NETWORK_LABELS[network]}</Text>
                    </Column>
                  </Row>
                </Card>
              </RevealFx>
            );
          })}
        </Grid>
      </Column>

      <Column gap="12" fillWidth>
        <Heading variant="heading-strong-m">Historial de Facturas</Heading>

        {invoices.length === 0 ? (
          <Column padding="40" horizontal="center" gap="m">
            <Icon name="receiptRefund" size="l" onBackground="neutral-weak" />
            <Text variant="body-default-m" onBackground="neutral-weak">Sin facturas aún</Text>
          </Column>
        ) : (
          <Column gap="8" fillWidth>
            {invoices.map((inv) => {
              const props = badgeProps(inv.status);
              const addr = addresses.find(
                (a) => a.asset === inv.asset && a.network === inv.network
              );

              return (
                <RevealFx key={inv.id} translateY="4">
                  <Card padding="16" radius="m" fillWidth>
                    <Row vertical="center" horizontal="between" fillWidth>
                      <Row gap="16" vertical="center">
                        <Icon
                          name={inv.status === "completed" ? "checkBadge" : "clock"}
                          size="m"
                        />
                        <Column gap="4">
                          <Row gap="8" vertical="center">
                            <Text variant="label-strong-s">{inv.asset}</Text>
                            <Badge {...props}>
                              {props.label}
                            </Badge>
                          </Row>
                          <Text variant="label-default-xs" onBackground="neutral-weak">
                            {NETWORK_LABELS[inv.network]} — {new Date(inv.createdAt).toLocaleDateString()}
                          </Text>
                          {inv.description && (
                            <Text variant="body-default-s">{inv.description}</Text>
                          )}
                        </Column>
                      </Row>
                      <Column horizontal="end" gap="4">
                        <Text variant="label-strong-m">
                          {formatCurrency(inv.amountFiat || 0)}
                        </Text>
                        {inv.txHash && (
                          <Text variant="label-default-xs" onBackground="neutral-weak">
                            TX: {inv.txHash.slice(0, 12)}...
                          </Text>
                        )}
                        {addr && (
                          <Text variant="label-default-xs" onBackground="neutral-weak">
                            {addr.address.slice(0, 10)}...
                          </Text>
                        )}
                      </Column>
                    </Row>
                  </Card>
                </RevealFx>
              );
            })}
          </Column>
        )}
      </Column>
    </Column>
  );
}
