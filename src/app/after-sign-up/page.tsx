import { redirect } from "next/navigation";
import { stackServerApp } from "@/stack/server";
import { ensureUserExists } from "@/db/sync-user";

export default async function AfterSignUpPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  await ensureUserExists({
    id: user.id,
    displayName: user.displayName,
    primaryEmail: user.primaryEmail,
  });

  redirect("/");
}
