export const colors = {
  primary: "#2E7D32",
  bg: "#F4F7F4",
  card: "#FFFFFF",
  text: "#1B1B1B",
  sub: "#6B7280",
  ok: "#2E7D32",
  warn: "#F9A825",
  danger: "#D32F2F",
};

export const fillColor = (v: number) =>
  v >= 80 ? colors.danger : v >= 50 ? colors.warn : colors.ok;