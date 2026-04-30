import React from "react";
import { GetProps, Text, YStack, styled } from "tamagui";

const ShellSectionFrame = styled(YStack, {
  gap: "$2",
  marginBottom: "$4",
  width: "100%",

  variants: {
    centered: {
      true: {
        alignSelf: "center",
      },
    },
  } as const,
});

const ShellSectionTitle = styled(Text, {
  fontSize: 16,
  fontWeight: "600",
  color: "$colorSecondary",
});

type ShellSectionProps = GetProps<typeof ShellSectionFrame> & {
  title?: string;
  maxWidth?: number;
};

export function ShellSection({
  title,
  children,
  maxWidth,
  ...props
}: ShellSectionProps) {
  return (
    <ShellSectionFrame maxWidth={maxWidth} {...props}>
      {title ? <ShellSectionTitle>{title}</ShellSectionTitle> : null}
      {children}
    </ShellSectionFrame>
  );
}
