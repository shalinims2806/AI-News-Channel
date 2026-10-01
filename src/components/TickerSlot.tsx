import { connection } from "next/server";
import { getBreaking } from "@/lib/queries";
import { safe } from "@/lib/utils";
import { BreakingTicker } from "./BreakingTicker";

export async function TickerSlot() {
  await connection(); // always render at request time, never bake into a static page
  const items = await safe(() => getBreaking(8), []);
  return <BreakingTicker initial={items} />;
}
