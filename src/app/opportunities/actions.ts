"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/firebase/server";

export async function saveOpportunityTracking(formData: FormData) {
  const opportunityId = formData.get("opportunityId");
  const status = formData.get("status");

  if (
    typeof opportunityId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(opportunityId) ||
    (status !== "saved" && status !== "applied")
  ) {
    throw new Error("Invalid opportunity tracking request.");
  }

  const firebaseStore = await createClient();
  const { data: claimsData, error: claimsError } =
    await firebaseStore.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    throw new Error("Sign in is required to track opportunities.");
  }

  const { error } = await firebaseStore
    .from("user_opportunity_tracking")
    .upsert(
      {
        user_id: userId,
        opportunity_id: opportunityId,
        status,
        applied_at:
          status === "applied" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,opportunity_id" },
    );

  if (error) {
    console.error("opportunity_tracking_save_failed", {
      code: error.code,
    });
    throw new Error("Opportunity tracking could not be saved.");
  }

  revalidatePath("/opportunities");
}

export async function removeOpportunityTracking(formData: FormData) {
  const opportunityId = formData.get("opportunityId");
  if (
    typeof opportunityId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(opportunityId)
  ) {
    throw new Error("Invalid opportunity tracking request.");
  }

  const firebaseStore = await createClient();
  const { data: claimsData, error: claimsError } =
    await firebaseStore.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    throw new Error("Sign in is required to update saved opportunities.");
  }

  const { error } = await firebaseStore
    .from("user_opportunity_tracking")
    .delete()
    .eq("user_id", userId)
    .eq("opportunity_id", opportunityId);

  if (error) {
    console.error("opportunity_tracking_delete_failed", {
      code: error.code,
    });
    throw new Error("Opportunity tracking could not be removed.");
  }

  revalidatePath("/opportunities");
}
