export type GuideLink = {
  /** Locale-less site path, e.g. "/gallery" — rendered through the i18n Link. */
  href: string;
  label: string;
};

export type GuideSection = {
  heading: string;
  /** Prose paragraphs rendered as <p>. */
  body?: string[];
  /** Optional ordered steps rendered as <ol>. */
  steps?: string[];
  /** Optional internal links rendered after the section. */
  links?: GuideLink[];
};

export type Guide = {
  slug: string;
  /** H1 + meta title core. */
  title: string;
  /** Meta description. */
  description: string;
  /** ISO date — drives <time>, sitemap lastmod, and Article.dateModified. */
  updated: string;
  /** Lead paragraph under the H1. */
  intro: string;
  sections: GuideSection[];
};
