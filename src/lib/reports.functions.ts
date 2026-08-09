import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends one digest immediately so a schedule can be previewed before it fires. */
export const runDigestNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ scheduleId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: schedule, error } = await context.supabase
      .from("report_schedules")
      .select("id")
      .eq("id", data.scheduleId)
      .maybeSingle();
    // RLS decides membership: an invisible row means this user may not run it.
    if (error) throw new Error(error.message);
    if (!schedule) throw new Error("Schedule not found");

    const { runDueDigests } = await import("@/lib/reports.server");
    return runDueDigests({ scheduleId: data.scheduleId, force: true });
  });
