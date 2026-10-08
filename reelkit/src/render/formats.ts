export const FORMATS = {
  "9x16": { w: 1080, h: 1920, label: "Reels · TikTok · Stories" },
  "4x5": { w: 1080, h: 1350, label: "Instagram & Facebook feed" },
  "1x1": { w: 1080, h: 1080, label: "Square" },
} as const;

export type FormatId = keyof typeof FORMATS;
export type Format = (typeof FORMATS)[FormatId];

export const FPS = 30;
