import { describe, expect, it } from "vitest";
import { checkGrounding } from "@/services/ai/grounding";
import { HeuristicProvider, guessCategory } from "@/services/ai/heuristic";
import { findStoryMatch, type StoryCandidate } from "@/services/ingestion/dedupe";
import { canonicalizeUrl, normalizeTitle, stripPublisherSuffix } from "@/services/ingestion/normalize";
import { stripHtml } from "@/lib/server-utils";
import { slugify } from "@/lib/utils";
import { storyLabel } from "@/lib/labels";

const cand = (id: string, title: string, sourceName: string, excerpt = ""): StoryCandidate => ({ id, title, excerpt, sourceName, titleHash: normalizeTitle(title) });

describe("canonicalizeUrl", () => {
  it("removes tracking params, fragments and trailing slash", () => {
    expect(canonicalizeUrl("https://Example.com/a/b/?utm_source=x&id=2&fbclid=z#top")).toBe("https://example.com/a/b?id=2");
  });
});

describe("normalizing titles", () => {
  it("strips publisher suffixes and punctuation", () => {
    expect(stripPublisherSuffix("Big news today - Daily Chronicle", "Daily Chronicle")).toBe("Big news today");
    expect(normalizeTitle("Big News: Today!")).toBe("big news today");
  });
});

describe("findStoryMatch", () => {
  const pool = [
    cand("1", "Chipmaker unveils new AI accelerator aimed at data centres", "Global Wire"),
    cand("2", "Parliament session: government introduces new digital services bill", "Daily Chronicle"),
  ];
  it("groups the same story from a different outlet", () => {
    const m = findStoryMatch({ title: "Chipmaker unveils new AI accelerator for data centres", excerpt: "", sourceName: "Tech Ledger" }, pool);
    expect(m?.kind).toBe("same-story");
    expect(m?.candidate.id).toBe("1");
  });
  it("skips an exact repeat from the same outlet", () => {
    const m = findStoryMatch({ title: "Chipmaker unveils new AI accelerator aimed at data centres", excerpt: "", sourceName: "Global Wire" }, pool);
    expect(m?.kind).toBe("same-source-duplicate");
  });
  it("does not merge unrelated stories", () => {
    expect(findStoryMatch({ title: "India clinch T20 series with a comfortable win", excerpt: "", sourceName: "Sports Desk" }, pool)).toBeNull();
  });
  it("does not merge different events sharing a few words", () => {
    expect(findStoryMatch({ title: "Government introduces new education policy", excerpt: "", sourceName: "Metro" }, pool)).toBeNull();
  });
});

describe("AI grounding guard", () => {
  const base = { headline: "Company reports results", keyPoints: [], category: "business" as const, tags: [] };
  it("rejects numbers absent from the source", () => {
    const r = checkGrounding({ ...base, summary: "Profit rose 45 percent in the quarter." }, "Company reports results. Profit rose in the quarter.");
    expect(r.ok).toBe(false);
  });
  it("rejects invented quotes", () => {
    const r = checkGrounding({ ...base, summary: 'The CEO said "we will win everything soon" on Monday.' }, "The CEO spoke on Monday.");
    expect(r.ok).toBe(false);
  });
  it("accepts grounded text", () => {
    const r = checkGrounding({ ...base, summary: "Profit rose 45 percent in the quarter." }, "Profit rose 45 percent in the quarter.");
    expect(r.ok).toBe(true);
  });
});

describe("heuristic provider", () => {
  it("summarizes extractively and never invents text", async () => {
    const excerpt = "The lab published model weights on Tuesday. The release includes smaller variants that run on consumer hardware.";
    const r = await new HeuristicProvider().process({ title: "Lab releases open model", excerpt, sourceName: "X", language: "en", categoryHint: "technology" });
    expect(excerpt).toContain(r.summary.split(". ")[0].replace(/\.$/, ""));
    expect(r.keyPoints.length).toBeGreaterThan(0);
  });
  it("classifies by keyword with the source category as a prior", () => {
    expect(guessCategory("Chennai metro trial run begins", "india")).toBe("tamil-nadu");
    expect(guessCategory("OpenAI launches a new model", "technology")).toBe("ai");
  });
});

describe("misc", () => {
  it("slugifies", () => expect(slugify("Hello, World & Café!")).toBe("hello-world-and-cafe"));
  it("strips html", () => expect(stripHtml("<p>Fish &amp; <b>chips</b></p>")).toBe("Fish & chips"));
  it("never claims confirmation from a single source", () => expect(storyLabel(1).text).toMatch(/Developing/));
});
