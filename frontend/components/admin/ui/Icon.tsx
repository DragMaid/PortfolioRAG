import { cn } from "@/lib/cn";

/**
 * The studio's icon set, drawn inline.
 *
 * The prototype pulled Material Symbols from Google Fonts. Inline paths instead: an icon
 * font is a render-blocking request that shows ligature text until it lands, and only a
 * dozen glyphs out of thousands were ever used.
 */
// TODO(review): deviates from the prototype, which loaded the Material Symbols webfont.
// The shapes are approximations of the ones it named, not the originals.
export type IconName =
  | "add"
  | "arrow-down"
  | "arrow-outward"
  | "arrow-up"
  | "bar-chart"
  | "check-circle"
  | "chevron-down"
  | "code"
  | "copy"
  | "download"
  | "edit-note"
  | "error"
  | "eye"
  | "folder"
  | "folder-managed"
  | "hub"
  | "image"
  | "link"
  | "person"
  | "publish"
  | "save"
  | "schedule"
  | "schema"
  | "share"
  | "spinner"
  | "stacked-chart"
  | "stats"
  | "stories"
  | "trash"
  | "upload"
  | "verified"
  | "video"
  | "work"
  | "x";

/** 24x24 viewBox, stroked, so every glyph shares a weight with the rest of the interface. */
const PATHS: Record<IconName, string> = {
  add: "M12 5v14M5 12h14",
  "arrow-down": "M12 5v14m0 0 5-5m-5 5-5-5",
  "arrow-outward": "M7 17 17 7M9 7h8v8",
  "arrow-up": "M12 19V5m0 0 5 5m-5-5-5 5",
  "bar-chart": "M4 20h16M8 20v-7M12 20V7M16 20v-4",
  "check-circle": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12.5l2.5 2.5 4.5-5",
  "chevron-down": "m6 9 6 6 6-6",
  code: "m9 8-4 4 4 4M15 8l4 4-4 4",
  copy: "M9 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM5 15H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1",
  download: "M12 4v11m0 0 4-4m-4 4-4-4M4 20h16",
  "edit-note": "M4 7h11M4 12h7M4 17h5M14.5 18.5 20 13l-2-2-5.5 5.5-.5 3 3-.5Z",
  error: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 8v5M12 16.2v.1",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z",
  folder: "M3 8V6a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z",
  "folder-managed":
    "M3 8V6a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8ZM9 14h6M9 11h6",
  hub: "M12 9.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 9.5v3M12 12.5 7 15.5M12 12.5l5 3",
  image: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 16l5-4 4 3 3-2.5 6 4.5M8.5 10a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z",
  link: "M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c0-3.3 3.1-5 7-5s7 1.7 7 5",
  publish: "M12 20V8m0 0-4 4m4-4 4 4M4 4h16",
  save: "M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 4v5h7V4M8 20v-6h8v6",
  schedule: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2",
  schema: "M4 4h6v4H4V4ZM14 16h6v4h-6v-4ZM4 16h6v4H4v-4ZM7 8v4h10v4M7 12v4",
  share: "M15 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 15a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM15 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8.2 11.3l4.6-2.6M8.2 13.7l4.6 2.6",
  spinner: "M12 3.5a8.5 8.5 0 1 1-8.5 8.5",
  "stacked-chart": "M4 20h16M7 20v-5M7 15v-4M12 20v-8M12 12V6M17 20v-3M17 17v-5",
  stats: "M4 20h16M7 17V9M12 17V5M17 17v-6M4 8l4-4 5 5 6-6",
  stories:
    "M4 5.5h5a2.5 2.5 0 0 1 2.5 2.5v11a2 2 0 0 0-2-2H4v-11ZM20 5.5h-5A2.5 2.5 0 0 0 12.5 8v11a2 2 0 0 1 2-2H20v-11Z",
  trash: "M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.1a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7",
  upload: "M12 16V5m0 0-4 4m4-4 4 4M4 20h16",
  verified:
    "m12 3 2.2 1.9 2.9-.3 1 2.7 2.6 1.3-.9 2.8.9 2.8-2.6 1.3-1 2.7-2.9-.3L12 21l-2.2-1.9-2.9.3-1-2.7-2.6-1.3.9-2.8-.9-2.8 2.6-1.3 1-2.7 2.9.3L12 3ZM9 12.2l2 2 4-4.4",
  video: "M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM16 10.5 21 8v8l-5-2.5v-3Z",
  work: "M4 8h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM9 8V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V8M3 13h18",
  x: "M6 6l12 12M18 6 6 18",
};

type IconProps = {
  name: IconName;
  className?: string;
  /** Icons here are decoration beside a label. Give a title only when one stands alone. */
  title?: string;
};

export function Icon({ name, className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={cn("size-[1em] shrink-0", name === "spinner" && "animate-spin", className)}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
