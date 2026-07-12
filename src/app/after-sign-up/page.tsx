import { redirect } from "next/navigation";
import { ensureUserExists } from "@/db/sync-user";
import { stackServerApp } from "@/stack/server";

export default async function AfterSignUpPage() {
  const user = await stackServerApp.getUser({ or: "redirect" });

  await ensureUserExists({
    id: user.id,
    displayName: user.displayName,
    primaryEmail: user.primaryEmail,
  });

  redirect("/");
}
