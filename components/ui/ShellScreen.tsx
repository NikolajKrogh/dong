import React from "react";
import { YStack, styled, GetProps } from "tamagui";

const ShellScreenFrame = styled(YStack, {
  flex: 1,
  backgroundColor: "$background",
  padding: "$4",

  variants: {
    padded: {
      false: { padding: 0 },
    },
  } as const,
});

type ShellScreenProps = GetProps<typeof ShellScreenFrame>;

export function ShellScreen({ children, ...props }: ShellScreenProps) {
  return <ShellScreenFrame {...props}>{children}</ShellScreenFrame>;
}
