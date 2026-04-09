import { stackServerApp } from "@/stack/server";
import AssignmentEditor from "@/components/assignment-editor";

interface EditAssignmentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditAssignmentPage({
  params,
}: EditAssignmentPageProps) {
  const { id } = await params;
  await stackServerApp.getUser({ or: "redirect" });
  // In a real app, you would fetch the Assignment data here
  // For now, we'll just show some mock data if it's not "new"
  const mockData =
    id !== "new"
      ? {
          title: `Sample Assignment ${id}`,
          content: `# Sample Assignment ${id}

This is some sample markdown content for Assignment ${id}.

## Features
- **Bold text**
- *Italic text*
- [Links](https://example.com)

## Code Example
\`\`\`javascript
console.log("Hello from Assignment ${id}");
\`\`\`

This would normally be fetched from your API.`,
        }
      : {};

  return (
    <AssignmentEditor
      initialTitle={mockData.title}
      initialContent={mockData.content}
      isEditing={true}
      assignmentId={id}
    />
  );
}
