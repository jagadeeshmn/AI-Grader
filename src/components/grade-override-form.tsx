"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { overrideGradeAction } from "@/app/actions/grading";
import type { CriterionScore } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface GradeOverrideFormProps {
  submissionId: number;
  initialCriterionScores: CriterionScore[];
  initialOverallFeedback: string;
  onClose: () => void;
}

export function GradeOverrideForm({
  submissionId,
  initialCriterionScores,
  initialOverallFeedback,
  onClose,
}: GradeOverrideFormProps) {
  const router = useRouter();
  const [scores, setScores] = useState<CriterionScore[]>(initialCriterionScores);
  const [overallFeedback, setOverallFeedback] = useState(initialOverallFeedback);
  const [saving, setSaving] = useState(false);

  const updateScore = (index: number, value: number) => {
    const clamped = Math.max(0, Math.min(value, scores[index].maxPoints));
    setScores((prev) => prev.map((c, i) => (i === index ? { ...c, score: clamped } : c)));
  };

  const updateFeedback = (index: number, value: string) => {
    setScores((prev) => prev.map((c, i) => (i === index ? { ...c, feedback: value } : c)));
  };

  const totalScore = scores.reduce((sum, c) => sum + c.score, 0);
  const maxScore = scores.reduce((sum, c) => sum + c.maxPoints, 0);

  const save = async () => {
    setSaving(true);
    try {
      await overrideGradeAction(submissionId, scores, overallFeedback);
      onClose();
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to save override. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Running total */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Manual Override</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono">{totalScore}/{maxScore}</span>
          <Badge variant="outline">
            {Math.round((totalScore / maxScore) * 100)}%
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Per-criterion overrides */}
      <div className="flex flex-col gap-4">
        {scores.map((cs, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: order is fixed
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium flex-1">{cs.criterion}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Input
                  type="number"
                  min={0}
                  max={cs.maxPoints}
                  value={cs.score}
                  onChange={(e) => updateScore(i, Number(e.target.value))}
                  className="w-16 text-center font-mono"
                />
                <span className="text-xs text-muted-foreground">/ {cs.maxPoints}</span>
              </div>
            </div>
            <textarea
              value={cs.feedback}
              onChange={(e) => updateFeedback(i, e.target.value)}
              rows={2}
              placeholder="Feedback for this criterion…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        ))}
      </div>

      <Separator />

      {/* Overall feedback */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Overall Feedback</label>
        <textarea
          value={overallFeedback}
          onChange={(e) => setOverallFeedback(e.target.value)}
          rows={3}
          placeholder="Overall feedback for the student…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Override"}
        </Button>
      </div>
    </div>
  );
}
