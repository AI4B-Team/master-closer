import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadStarterData } from "./starter.server";

/** Fills an empty workspace with a realistic starter set the user can edit. */
export const seedStarterWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadStarterData(context.supabase as any, context.userId));
