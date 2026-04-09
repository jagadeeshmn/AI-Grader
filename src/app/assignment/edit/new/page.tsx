import AssignmentEditor from "@/components/assignment-editor";
import { stackServerApp } from "@/stack/server";

export default async function NewAssignmentPage() {
  await stackServerApp.getUser({ or: "redirect" });
  return <AssignmentEditor isEditing={false} />;
}
