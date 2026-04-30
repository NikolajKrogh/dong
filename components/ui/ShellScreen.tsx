import React from "react";
import { GetProps, YStack, styled } from "tamagui";

const ShellScreenFrame = styled(YStack, {
  flex: 1,
  backgroundColor: "$background",
  padding: "$4",
  width: "100%",

  variants: {
    padded: {
      false: { padding: 0 },
    },
  } as const,
});

const ShellScreenContent = styled(YStack, {
  flex: 1,
  width: "100%",
  minWidth: 0,

  variants: {} as const,
});

const ShellScreenViewport = styled(YStack, {
  flex: 1,
  width: "100%",
  alignSelf: "stretch",
  minWidth: 0,

  variants: {
    centered: {
      true: {
        alignItems: "center",
      },
    },
  } as const,
});

type ShellScreenProps = GetProps<typeof ShellScreenFrame> & {
  centerContent?: boolean;
  contentMaxWidth?: number;
  contentProps?: GetProps<typeof ShellScreenContent>;
};

export function ShellScreen({
  children,
  centerContent = false,
  contentMaxWidth,
  contentProps,
  ...props
}: ShellScreenProps) {
  return (
    <ShellScreenFrame {...props}>
      <ShellScreenViewport centered={centerContent}>
        <ShellScreenContent maxWidth={contentMaxWidth} {...contentProps}>
          {children}
        </ShellScreenContent>
      </ShellScreenViewport>
    </ShellScreenFrame>
  );
}
