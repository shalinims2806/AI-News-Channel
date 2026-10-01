import type { RawItem } from "./ingestion/feeds";

/**
 * Realistic-looking development fixtures. Sources, publishers and URLs are fictional
 * (example.com); the same story is intentionally reported by several fictional outlets so
 * duplicate grouping and "Covered by N sources" can be exercised without any network access.
 * Live feeds are used as soon as real sources are enabled.
 */
const h = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000 - Math.random() * 600_000);

export interface SampleEntry { publisher: string; category: string; item: RawItem }

const mk = (publisher: string, category: string, slug: string, title: string, excerpt: string, hoursAgo: number, image = false): SampleEntry => ({
  publisher,
  category,
  item: {
    title,
    link: `https://${publisher.toLowerCase().replace(/[^a-z]/g, "")}.example.com/${slug}`,
    publishedAt: h(hoursAgo),
    excerpt,
    imageUrl: image ? `https://picsum.photos/seed/${slug}/1200/675` : null,
    author: null,
    publisher,
  },
});

export const SAMPLE_PUBLISHERS = ["Daily Chronicle", "Global Wire", "Tech Ledger", "Southern Post", "Metro Business Review", "Sports Desk"];

export const SAMPLE_ENTRIES: SampleEntry[] = [
  // Same story, three outlets → grouped, becomes "breaking" (>=3 sources within window)
  mk("Global Wire", "ai", "chipmaker-unveils-ai-accelerator", "Chipmaker unveils new AI accelerator aimed at data centres", "The company said the new accelerator is designed for training large language models and will begin shipping to cloud providers later this year. Executives said it uses a redesigned memory architecture.", 1.2, true),
  mk("Tech Ledger", "technology", "ai-accelerator-data-centres", "Chipmaker unveils new AI accelerator for data centres", "Tech Ledger reports the accelerator targets large language model training and will ship to cloud providers this year, according to the company.", 1.0),
  mk("Daily Chronicle", "technology", "new-ai-chip-launch", "Chipmaker launches new AI accelerator for data centres", "The launch positions the company against rivals in the market for AI training hardware. Analysts cited by the outlet said pricing has not been disclosed.", 0.8),

  mk("Tech Ledger", "ai", "open-source-model-release", "Research lab releases open-source language model for developers", "The lab published model weights and a technical report on Tuesday. The release includes smaller variants that can run on consumer hardware, the lab said in a blog post.", 2.5, true),
  mk("Global Wire", "ai", "developers-ai-coding-assistants", "Survey finds most developers now use AI coding assistants", "A survey of software developers found that a majority use AI coding assistants at least weekly, though many said they still review all generated code by hand.", 3.4, true),

  mk("Southern Post", "tamil-nadu", "chennai-metro-phase-two", "Chennai Metro phase two: new stretch opens for trial runs", "Officials said trial runs began on the newly completed stretch. Commercial operations will start after safety clearances are received, they added.", 2.0, true),
  mk("Southern Post", "tamil-nadu", "delta-farmers-irrigation", "Tamil Nadu announces irrigation support for delta farmers", "The state government announced a support package for farmers in the delta districts ahead of the sowing season, according to an official statement.", 5.5),

  mk("Daily Chronicle", "india", "parliament-session-bill", "Parliament session: government introduces new digital services bill", "The bill was introduced in the Lok Sabha on Monday. Opposition members asked for it to be referred to a standing committee for detailed examination.", 4.1, true),
  mk("Metro Business Review", "business", "markets-close-higher", "Sensex and Nifty close higher led by banking and IT stocks", "Benchmark indices ended the session higher as banking and IT shares gained. Analysts said investors were awaiting the central bank's policy announcement.", 3.0),
  mk("Global Wire", "business", "rbi-policy-preview", "RBI policy preview: economists expect rates to stay unchanged", "Most economists surveyed expect the central bank to hold the repo rate steady, citing easing inflation and steady growth.", 6.2, true),

  mk("Global Wire", "world", "summit-climate-talks", "World leaders open climate summit with calls for faster action", "Delegates from more than 100 countries gathered for the opening session. Host officials urged negotiators to agree on financing commitments.", 4.8, true),
  mk("Daily Chronicle", "world", "trade-talks-resume", "Trade talks resume between two major economies after a pause", "Negotiators met for a first round of talks in several months. Both sides described the discussions as constructive but gave no details.", 7.0),

  mk("Sports Desk", "sports", "final-cricket-series", "India clinch T20 series with a comfortable win in the final match", "Chasing a modest target, the hosts reached the total with several overs to spare to take the series. The captain praised the bowling unit after the match.", 5.0, true),
  mk("Sports Desk", "sports", "football-league-title-race", "League title race tightens after leaders drop points", "The league leaders were held to a draw at home, allowing the chasing pack to close the gap at the top of the table.", 8.0),

  mk("Daily Chronicle", "entertainment", "film-festival-lineup", "Film festival announces lineup with several regional language premieres", "Organisers said the programme includes Tamil, Malayalam and Hindi films alongside international selections. Screenings begin next month.", 9.0, true),
  mk("Global Wire", "entertainment", "streaming-series-renewed", "Popular streaming series renewed for another season", "The streaming service confirmed the renewal in a statement. Production is expected to begin later this year, the statement said.", 10.0),

  mk("Tech Ledger", "science", "mission-lunar-orbiter", "Space agency's lunar orbiter sends back new high-resolution images", "The images show details of the polar regions, the agency said. Scientists will use the data to study potential landing sites for future missions.", 6.0, true),
  mk("Global Wire", "science", "study-coral-reefs", "Study finds some coral reefs recovering faster than expected", "Researchers reported signs of recovery at several monitored reef sites, but cautioned that rising ocean temperatures remain a significant threat.", 11.0),
  mk("Tech Ledger", "technology", "smartphone-launch-event", "Smartphone maker schedules launch event for next-generation flagship", "The company sent invitations for an event next week. It did not disclose specifications, though it said the device will feature on-device AI features.", 12.0, true),
];
