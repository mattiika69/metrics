export const authRedirectParam = "redirect";
export const legacyAuthRedirectParam = "next";

export function sanitizeAuthRedirect(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim() ?? "";

  if (
    !trimmed ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("://") ||
    trimmed.includes("\\")
  ) {
    return fallback;
  }

  return trimmed;
}

export function readAuthRedirectParam(
  params: Record<string, string | string[] | undefined>,
  fallback: string,
) {
  const redirectValue = params[authRedirectParam];
  const legacyValue = params[legacyAuthRedirectParam];
  const value = Array.isArray(redirectValue)
    ? redirectValue[0]
    : redirectValue ?? (Array.isArray(legacyValue) ? legacyValue[0] : legacyValue);

  return sanitizeAuthRedirect(value, fallback);
}

export function readAuthRedirectFormValue(formData: FormData, fallback: string) {
  const redirectValue = formData.get(authRedirectParam);
  const legacyValue = formData.get(legacyAuthRedirectParam);
  const value = typeof redirectValue === "string"
    ? redirectValue
    : typeof legacyValue === "string"
      ? legacyValue
      : null;

  return sanitizeAuthRedirect(value, fallback);
}

export function appendAuthRedirect(path: string, redirectTo: string, fallback: string) {
  const safeRedirect = sanitizeAuthRedirect(redirectTo, fallback);

  if (safeRedirect === fallback) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${authRedirectParam}=${encodeURIComponent(safeRedirect)}`;
}
