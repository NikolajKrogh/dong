import React from "react";
import { YStack, Text, styled, GetProps } from "tamagui";

const ShellSectionFrame = styled(YStack, {
  gap: "$2",
  marginBottom: "$4",
});

const ShellSectionTitle = styled(Text, {
  fontSize: 16,
  fontWeight: "600",
  color: "$colorSecondary",
});

type ShellSectionProps = GetProps<typeof ShellSectionFrame> & {
  title?: string;
};

export function ShellSection({
  title,
  children,
  ...props
}: ShellSectionProps) {
  return (
    <ShellSectionFrame {...props}>
      {title ? <ShellSectionTitle>{title}</ShellSectionTitle> : null}
      {children}
    </ShellSectionFrame>
  );
}
