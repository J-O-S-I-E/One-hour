import "server-only";
import { redirect } from "next/navigation";
import { getUserId } from "./supabase/server";
import type { Profile } from "./types";

/** For server pages: the signed-in user's client + profile, redirecting if needed. */
export async function requireProfile({ onboarded = true } = {}) {
  const { supabase, userId } = await getUserId();
  if (!userId) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single<Profile>();
  if (!profile) redirect("/login");
  if (onboarded && !profile.onboarded) redirect("/onboarding");
  return { supabase, userId, profile };
}
