import { createTheme, type MantineColorsTuple } from "@mantine/core";

// One accent, and the rest of the palette left to Mantine. The colours that carry meaning
// here are the state ones in components/StateBadge, and an accent that competed with them
// would make the table harder to read at a glance, not easier.
const ink: MantineColorsTuple = [
  "#f4f5f7",
  "#e6e8eb",
  "#ccd0d6",
  "#b0b6bf",
  "#9aa1ac",
  "#8b93a0",
  "#838c9b",
  "#707888",
  "#636b7a",
  "#545c6c",
];

export const theme = createTheme({
  primaryColor: "indigo",
  colors: { ink },
  defaultRadius: "md",
  fontFamilyMonospace:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  headings: { fontWeight: "600" },
  components: {
    Badge: { defaultProps: { variant: "light" } },
    Button: { defaultProps: { variant: "default" } },
  },
});
