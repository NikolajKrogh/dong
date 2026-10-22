import React from "react";
import { Link, type Href } from "expo-router";
import { Platform, type Role } from "react-native";
import { GetProps, Text, XStack, styled } from "tamagui";

const ShellActionButtonFrame = styled(XStack, {
  alignItems: "center",
  justifyContent: "center",
  gap: "$2",
  width: "100%",
  minWidth: 44,
  minHeight: 44,
  borderWidth: 0,
  cursor: "pointer",
  focusVisibleStyle: {
    outlineWidth: 2,
    outlineStyle: "solid",
    outlineColor: "$primaryFocus",
    outlineOffset: 3,
  },
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
        style: { pointerEvents: "none" },
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
  href?: Href;
};

export function ShellActionButton({
  label,
  icon,
  onPress,
  href,
  variant,
  accessibilityLabel,
  accessibilityState,
  accessibilityRole,
  ...props
}: ShellActionButtonProps) {
  const disabled = Boolean(props.disabled || accessibilityState?.disabled);
  const isWeb = Platform.OS === "web";
  const linkHref = disabled ? undefined : href;
  const accessibilityProps = getAccessibilityProps({
    role: props.role, accessibilityRole, accessibilityLabel, accessibilityState,
  }, disabled, Boolean(linkHref));
  const controlLabel = accessibilityLabel ?? label;
  const button = (
    <ShellActionButtonFrame
      {...props}
      variant={variant}
      {...(isWeb ? { render: linkHref ? <a href={Link.resolveHref(linkHref)} aria-label={controlLabel} style={{ textDecoration: "none" }} /> : <button type="button" aria-label={controlLabel} /> } : {})}
      {...(isWeb && !linkHref ? { type: "button" as const } : {})}
      {...accessibilityProps}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
    >
      <ShellActionContent icon={icon} label={label} variant={variant} />
    </ShellActionButtonFrame>
  );
  return linkHref ? <Link href={linkHref} asChild>{button}</Link> : button;
}

function getAccessibilityProps(
  { role, accessibilityRole, accessibilityLabel, accessibilityState }: Pick<ShellActionButtonProps,
    "role" | "accessibilityRole" | "accessibilityLabel" | "accessibilityState">,
  disabled: boolean,
  isLink: boolean,
) {
  const defaultRole = isLink ? "link" : "button";
  if (Platform.OS === "web") {
    return {
      role: role ?? (accessibilityRole as Role | undefined) ?? defaultRole,
      "aria-label": accessibilityLabel,
      "aria-disabled": disabled,
      "aria-expanded": accessibilityState?.expanded,
      "aria-selected": accessibilityState?.selected,
      "aria-checked": accessibilityState?.checked,
      "aria-busy": accessibilityState?.busy,
    };
  }
  return {
    accessibilityLabel,
    accessibilityRole: accessibilityRole ?? defaultRole,
    accessibilityState: disabled ? { ...accessibilityState, disabled: true } : accessibilityState,
  };
}

function ShellActionContent({ icon, label, variant }: Pick<ShellActionButtonProps, "icon" | "label" | "variant">): React.JSX.Element {
  const isWeb = Platform.OS === "web";
  return <>
      {icon ? <XStack aria-hidden={isWeb ? true : undefined} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{icon}</XStack> : null}
      {label ? (
        <ShellActionButtonLabel fontFamily={isWeb ? "system-ui" : undefined} surfaceText={variant === "surface"}>
          {label}
        </ShellActionButtonLabel>
      ) : null}
  </>;
}
