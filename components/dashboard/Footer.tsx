/*
 * Quartly Bot — components/dashboard/Footer.tsx
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 */

"use client";

import { Row, Text } from "@once-ui-system/core";
import { BsHeartFill } from "react-icons/bs";

export function Footer() {
  return (
    <Row
      padding="m"
      horizontal="center"
      vertical="center"
      gap="xs"
      style={{
        borderTop: "1px solid var(--neutral-alpha-weak)",
        opacity: 0.6,
      }}
    >
      <Text variant="body-default-xs" onBackground="neutral-weak">
        Hecho con
      </Text>
      <BsHeartFill
        size={12}
        style={{ color: "var(--brand-medium)" }}
      />
      <Text variant="body-default-xs" onBackground="neutral-weak">
        por Donovan Riano
      </Text>
      <Text variant="body-default-xs" onBackground="neutral-weak">
        {" "}
        &copy; {new Date().getFullYear()}
      </Text>
    </Row>
  );
}
