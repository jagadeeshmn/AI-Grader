"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Plus, Trash2 } from "lucide-react";
import {
  addCourseMaterialAction,
  deleteCourseMaterialAction,
} from "@/app/actions/materials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Material = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

interface CourseMaterialsProps {
  courseId: number;
  materials: Material[];
}

export function CourseMaterials({ courseId, materials }: CourseMaterialsProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Reference Materials
          </CardTitle>
          {materials.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {materials.length} material{materials.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Existing materials */}
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No reference materials uploaded yet. Add materials to enable
            RAG-based grading.
          </p>
        ) : (
          <div className="flex flex-col divide-y">
            {materials.map((material) => {
              const isExpanded = expandedId === material.id;
              return (
                <div
                  key={material.id}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : material.id)
                      }
                      className="flex items-center gap-3 min-w-0 text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {material.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(material.createdAt).toLocaleDateString(
                            "en-US",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                        </p>
                      </div>
                    </button>
                    <form action={deleteCourseMaterialAction}>
                      <input
                        type="hidden"
                        name="materialId"
                        value={material.id}
                      />
                      <input type="hidden" name="courseId" value={courseId} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 ml-11 rounded-md border bg-muted/50 p-4 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {material.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Separator />

        {/* Add material form */}
        <form action={addCourseMaterialAction} className="flex flex-col gap-3">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Add reference material
          </p>
          <input type="hidden" name="courseId" value={courseId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material-title">Title</Label>
            <Input
              id="material-title"
              name="title"
              placeholder="e.g. Week 3 Lecture Notes"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material-content">Content</Label>
            <textarea
              id="material-content"
              name="content"
              placeholder="Paste the reference material text here..."
              required
              rows={6}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <Button type="submit" size="sm" className="self-start">
            <Plus className="h-4 w-4 mr-1" />
            Upload &amp; Embed
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
