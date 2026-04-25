import React from "react";
import { XStack, Text, styled, GetProps } from "tamagui";

const ShellActionButtonFrame = styled(XStack, {
  alignItems: "center",
  justifyContent: "center",
  gap: "$2",
  paddingVertical: "$3",
  paddingHorizontal: "$4",
  borderRadius: "$3",
  backgroundColor: "$primary",
  pressStyle: { opacity: 0.85 },

  variants: {
    variant: {
      primary: { backgroundColor: "$primary" },
      success: { backgroundColor: "$success" },
      danger: { backgroundColor: "$danger" },
      secondary: { backgroundColor: "$secondary" },
      surface: {
        backgroundColor: "$surface",
        borderWidth: 1,
        borderColor: "$borderColor",
      },
    },
    size: {
      small: {
        paddingVertical: "$2",
        paddingHorizontal: "$3",
      },
      large: {
        paddingVertical: "$3.5",
        paddingHorizontal: "$5",
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
        pointerEvents: "none",
      },
    },
  } as const,

  defaultVariants: {
    variant: "primary",
  },
});

const ShellActionButtonLabel = styled(Text, {
  color: "$textLight",
  fontSize: 16,
  fontWeight: "600",

  variants: {
    surfaceText: {
      true: { color: "$color" },
    },
  } as const,
});

type ShellActionButtonProps = GetProps<typeof ShellActionButtonFrame> & {
  label?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
};

export function ShellActionButton({
  label,
  icon,
  onPress,
  variant,
  ...props
}: ShellActionButtonProps) {
  return (
    <ShellActionButtonFrame
      variant={variant}
      onPress={onPress}
      {...props}
    >
      {icon}
      {label ? (
        <ShellActionButtonLabel surfaceText={variant === "surface"}>
          {label}
        </ShellActionButtonLabel>
      ) : null}
    </ShellActionButtonFrame>
  );
}
