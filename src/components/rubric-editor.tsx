"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { updateAssignmentRubric } from "@/app/actions/assignments";
import type { RubricCriterion } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RubricEditorProps {
  assignmentId: number;
  initialRubric: RubricCriterion[];
  onClose: () => void;
}

export function RubricEditor({ assignmentId, initialRubric, onClose }: RubricEditorProps) {
  const router = useRouter();
  const [criteria, setCriteria] = useState<RubricCriterion[]>(
    initialRubric.length > 0
      ? initialRubric
      : [{ criterion: "", maxPoints: 10, description: "" }]
  );
  const [saving, setSaving] = useState(false);

  const update = (index: number, field: keyof RubricCriterion, value: string | number) =>
    setCriteria((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));

  const add = () =>
    setCriteria((prev) => [...prev, { criterion: "", maxPoints: 10, description: "" }]);

  const remove = (index: number) =>
    setCriteria((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    setSaving(true);
    try {
      await updateAssignmentRubric(assignmentId, criteria);
      onClose();
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to save rubric. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {criteria.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: order is user-controlled
        <div key={i} className="rounded-lg border p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Criterion name"
              value={c.criterion}
              onChange={(e) => update(i, "criterion", e.target.value)}
              className="flex-1"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                type="number"
                min={0}
                value={c.maxPoints}
                onChange={(e) => update(i, "maxPoints", Number(e.target.value))}
                className="w-20 text-center"
              />
              <span className="text-xs text-muted-foreground">pts</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
              onClick={() => remove(i)}
              disabled={criteria.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <textarea
            placeholder="Description (optional)"
            value={c.description}
            onChange={(e) => update(i, "description", e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={add}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add Criterion
      </Button>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Rubric"}
        </Button>
      </div>
    </div>
  );
}
