import Inventory from "@/components/Inventory";
import { listItems } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Inventory initial={listItems()} />;
}
