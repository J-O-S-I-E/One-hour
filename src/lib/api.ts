import "server-only";
import { z } from "zod";
import { PlanningError } from "./planning";
import { getUserId } from "./supabase/server";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Resolves the signed-in user and parses the JSON body, or returns an error Response. */
export async function authedJson<T extends z.ZodType>(request: Request, schema: T) {
  const { supabase, userId } = await getUserId();
  if (!userId) return { error: jsonError("Not signed in", 401) } as const;
  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    // empty body is fine for schemas with defaults
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400) } as const;
  return { supabase, userId, body: parsed.data as z.infer<T> } as const;
}

export function handleError(err: unknown) {
  if (err instanceof PlanningError) return jsonError(err.message, err.status);
  console.error(err);
  return jsonError("Something went wrong", 500);
}
