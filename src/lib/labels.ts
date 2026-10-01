/**
 * Deterministic story-status label. It is derived ONLY from how many independent outlets
 * carry the story — never from AI output — so the platform cannot manufacture confirmation.
 */
export function storyLabel(sourceCount: number): { text: string; tone: "developing" | "multi" | "single" } {
  if (sourceCount >= 3) return { text: `Covered by ${sourceCount} sources`, tone: "multi" };
  if (sourceCount === 2) return { text: "Covered by 2 sources", tone: "multi" };
  return { text: "Developing · single source", tone: "developing" };
}
