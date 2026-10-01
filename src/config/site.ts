/**
 * Single configuration point for branding and social links.
 * Everything here comes from environment variables so nothing is hard-coded.
 * Server-only: pass values to client components as props.
 */
const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : "");

export const siteConfig = {
  name: clean(process.env.SITE_NAME) || "AI News Channel",
  tagline:
    clean(process.env.SITE_TAGLINE) || "Latest news, summarized by AI. Always linked to the original source.",
  url: (clean(process.env.SITE_URL) || "http://localhost:3000").replace(/\/$/, ""),
  contactEmail: clean(process.env.CONTACT_EMAIL) || "contact@example.com",
  social: {
    instagram: clean(process.env.INSTAGRAM_URL),
    facebook: clean(process.env.FACEBOOK_URL),
    telegram: clean(process.env.TELEGRAM_URL),
  },
  defaultLanguage: "en",
  /** Languages the UI/AI pipeline is designed to support. Only "en" is enabled today. */
  languages: { en: "English", ta: "தமிழ்", hi: "हिन्दी", ml: "മലയാളം", te: "తెలుగు", kn: "ಕನ್ನಡ" } as Record<string, string>,
  enabledLanguages: ["en"],
} as const;

export type SocialLinks = typeof siteConfig.social;

export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/latest", label: "Latest" },
  { href: "/breaking", label: "Breaking News" },
  { href: "/category/india", label: "India" },
  { href: "/category/world", label: "World" },
  { href: "/category/technology", label: "Technology" },
  { href: "/category/ai", label: "AI" },
  { href: "/category/business", label: "Business" },
  { href: "/category/sports", label: "Sports" },
  { href: "/category/entertainment", label: "Entertainment" },
  { href: "/category/science", label: "Science" },
];

export const FOOTER_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/editorial-policy", label: "Editorial Policy" },
  { href: "/sources", label: "Sources" },
];

/** Runtime tuning knobs (all overridable through env). */
export const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : d;
};
export const pipelineConfig = {
  get maxArticleAgeHours() { return num(process.env.MAX_ARTICLE_AGE_HOURS, 72); },
  get maxNewPerRun() { return num(process.env.MAX_NEW_PER_RUN, 40); },
  get maxAiPerRun() { return num(process.env.MAX_AI_PER_RUN, 30); },
  get breakingMinSources() { return num(process.env.BREAKING_MIN_SOURCES, 3); },
  get breakingWindowHours() { return num(process.env.BREAKING_WINDOW_HOURS, 3); },
};
