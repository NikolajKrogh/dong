import * as Linking from "expo-linking";

const normalizeOptionalAccountText = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";

  return trimmedValue.length > 0 ? trimmedValue : null;
};

export const normalizeAccountDisplayName = (value: string | null | undefined) =>
  normalizeOptionalAccountText(value);

export const normalizeAccountFlowReturnTo = (
  value: string | string[] | null | undefined,
): string | null => {
  if (Array.isArray(value)) {
    return normalizeAccountFlowReturnTo(value[0]);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.startsWith("/") ? trimmedValue : null;
};

export const buildAccountAuthRoute = (
  route:
    | "/auth"
    | "/auth/onboarding"
    | "/auth/reset-password"
    | "/auth/change-password",
  returnTo?: string | null,
  extraParams?: Record<string, string>,
): string => {
  const normalizedReturnTo = normalizeAccountFlowReturnTo(returnTo);
  const params: string[] = [];
  if (normalizedReturnTo) {
    params.push(`returnTo=${encodeURIComponent(normalizedReturnTo)}`);
  }
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value)
        params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return params.length > 0 ? `${route}?${params.join("&")}` : route;
};

export const buildAccountAuthRedirectUrl = (
  route:
    | "/auth"
    | "/auth/onboarding"
    | "/auth/reset-password"
    | "/auth/change-password",
  returnTo?: string | null,
) => Linking.createURL(buildAccountAuthRoute(route, returnTo));
