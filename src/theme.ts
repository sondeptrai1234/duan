export const colors = {
  primary: "#13865A",
  primaryDark: "#087B52",
  bg: "#F5F8F5",
  card: "#FFFFFF",
  text: "#17372B",
  sub: "#82938A",
  line: "#E5EDE7",
  pale: "#E7F5EC",
  ok: "#20A36A",
  warn: "#D99A35",
  danger: "#D9534F",
  blue: "#5795C7",
  darkGreen: "#173F30",
};
export const fillColor = (value: number) => value >= 80 ? colors.danger : value >= 50 ? colors.warn : colors.ok;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
export const radius = { sm: 10, md: 14, lg: 18, xl: 24 };
