import React from "react";
import { YStack, styled, GetProps } from "tamagui";

const ShellCardFrame = styled(YStack, {
  backgroundColor: "$surface",
  borderRadius: "$3",
  padding: "$4",
  borderWidth: 1,
  borderColor: "$borderColor",
  shadowColor: "$borderColor",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,

  variants: {
    elevated: {
      true: {
        shadowOpacity: 0.2,
        elevation: 3,
      },
    },
    compact: {
      true: {
        padding: "$3",
      },
    },
  } as const,
});

type ShellCardProps = GetProps<typeof ShellCardFrame>;

export function ShellCard({ children, ...props }: ShellCardProps) {
  return <ShellCardFrame {...props}>{children}</ShellCardFrame>;
}
