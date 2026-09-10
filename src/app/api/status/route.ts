import { json } from "@/lib/api";
import { diagnostics } from "@/lib/store";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
  try { return json(await diagnostics()); }
  catch (e) { return json({ fatal: (e as Error).message }, { status: 500 }); }
}
