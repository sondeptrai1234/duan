import { createTamagui } from "tamagui";
import { defaultConfig } from "@tamagui/config/v6";

const base = defaultConfig as any;
export const tamaguiConfig = createTamagui({
  ...base,
  themes: {
    ...base.themes,
    light: { ...base.themes.light, background: "#F5F8F5", color: "#17372B", eco: "#13865A" },
    dark: { ...base.themes.dark, background: "#12231B", color: "#F3F8F4", eco: "#54C88D" },
  },
});
export default tamaguiConfig;
export type AppTamaguiConfig = typeof tamaguiConfig;
declare module "tamagui" { interface TamaguiCustomConfig extends AppTamaguiConfig {} }
