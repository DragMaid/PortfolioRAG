/** Single source for the header nav and the footer's navigation column. */
export const navItems = [
  { href: "#about", label: "About", shortLabel: "About", indexed: "01 / Overview" },
  {
    href: "#experience",
    label: "Experience",
    shortLabel: "Career",
    indexed: "02 / Experience",
  },
  {
    href: "#projects",
    label: "Selected Works",
    shortLabel: "Works",
    indexed: "03 / Works",
  },
  { href: "#contact", label: "Contact", shortLabel: "Contact", indexed: "04 / Contact" },
] as const;
