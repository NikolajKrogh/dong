import React from "react";
import { GetProps, Text, XStack, styled } from "tamagui";

const ShellActionButtonFrame = styled(XStack, {
  alignItems: "center",
  justifyContent: "center",
  gap: "$2",
  width: "100%",
  minWidth: 0,
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
    /**
     * How the button claims horizontal space.
     *
     * The frame is `width: "100%"` by default, and **only `fit` changes that**.
     * `capped` and `wide` stay full-width and merely bound how far they stretch,
     * which is what you want for a stacked call-to-action on a tablet — and
     * exactly what you do not want inside a row, where every sibling then demands
     * the whole width and the row overflows off-screen.
     *
     * `capped` was previously named `content`, which read as "size to content" and
     * was used that way at every one of its call sites; all of them were rows, and
     * all of them clipped.
     *
     * Inside an `XStack`, reach for `fit`.
     */
    widthMode: {
      /** Full width, bounded at 420 and centred. For stacked CTAs. */
      capped: {
        maxWidth: 420,
        alignSelf: "center",
      },
      /** Full width, bounded at 560 and centred. For stacked CTAs on wide screens. */
      wide: {
        maxWidth: 560,
        alignSelf: "center",
      },
      /** Sized to its label. The only option that belongs in a row. */
      fit: {
        width: "auto",
        alignSelf: "flex-start",
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
  flexShrink: 1,
  textAlign: "center",

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
    <ShellActionButtonFrame variant={variant} onPress={onPress} {...props}>
      {icon}
      {label ? (
        <ShellActionButtonLabel surfaceText={variant === "surface"}>
          {label}
        </ShellActionButtonLabel>
      ) : null}
    </ShellActionButtonFrame>
  );
}
