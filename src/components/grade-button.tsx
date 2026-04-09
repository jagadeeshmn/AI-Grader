"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GradeWithAIButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Grading…
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-2" />
          Grade with AI
        </>
      )}
    </Button>
  );
}

export function ReGradeButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          Grading…
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Re-grade with AI
        </>
      )}
    </Button>
  );
}
