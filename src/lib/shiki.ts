/**
 * Dual themes emit both colours as CSS variables on every token; `globals.css`
 * picks one based on `prefers-color-scheme`.
 */
export const SHIKI_THEMES = { light: "github-light", dark: "github-dark" } as const;
