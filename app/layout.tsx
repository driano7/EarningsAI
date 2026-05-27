import "@once-ui-system/core/css/styles.css";
import "@once-ui-system/core/css/tokens.css";
import "@/resources/custom.css";
import "@/resources/tokens.scss";

import classNames from "classnames";
import { Flex, ThemeInit } from "@once-ui-system/core";
import { fonts, style, dataStyle } from "@/resources/once-ui.config";
import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Flex
      suppressHydrationWarning
      as="html"
      lang="en"
      fillWidth
      className={classNames(
        fonts.heading.variable,
        fonts.body.variable,
        fonts.label.variable,
        fonts.code.variable
      )}
    >
      <head>
        <ThemeInit
          config={{
            theme: style.theme,
            brand: style.brand,
            accent: style.accent,
            neutral: style.neutral,
            solid: style.solid,
            "solid-style": style.solidStyle,
            border: style.border,
            surface: style.surface,
            transition: style.transition,
            scaling: style.scaling,
            "viz-style": dataStyle.variant,
          }}
        />
        <title>Quartly Dashboard</title>
        <meta name="description" content="Quartly Bot - Dashboard de monitoreo" />
      </head>
      <Providers>
        <Flex as="body" fillWidth margin="0" padding="0" background="page">
          {children}
        </Flex>
      </Providers>
    </Flex>
  );
}
