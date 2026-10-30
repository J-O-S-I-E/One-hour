import { requireProfile } from "@/lib/session";
import type { Campus } from "@/lib/types";
import { PreferencesForm } from "./preferences-form";

export default async function OnboardingPage() {
  const { supabase, profile } = await requireProfile({ onboarded: false });
  const { data: campuses } = await supabase.from("campuses").select("*").order("name");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{profile.onboarded ? "Your preferences" : "Let's set you up"}</h1>
        <p className="text-muted">These shape every suggestion. You can change them any time.</p>
      </div>
      <PreferencesForm profile={profile} campuses={(campuses ?? []) as Campus[]} />
    </div>
  );
}
