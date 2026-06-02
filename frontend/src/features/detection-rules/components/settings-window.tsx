"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SettingsDeleteConfirmation } from "@/features/detection-rules/components/settings-delete-confirmation";
import {
  SettingsRuleCreator,
  type RuleFormData,
  type TemplateFormData,
  type VectorFormData,
} from "@/features/detection-rules/components/settings-rule-creator";
import {
  useDetectionTemplates,
  useDetectedElements,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type DetectionTemplateItem,
} from "@/features/detection-rules/hooks/use-detection-rules";
import { ForbiddenAreasPanel } from "@/features/forbidden-zones/components/forbidden-areas-panel";
import { cn } from "@/lib/utils";
import type { DetectionVectorDTO } from "@/types/api";

type SettingsTab = "rules" | "areas";

function createEmptyRule(defaultElementName = ""): RuleFormData {
  return {
    element_name: defaultElementName,
    mode: "exact",
    count: 1,
    count_from: 1,
    count_to: 2,
  };
}

function createEmptyVector(defaultElementName = ""): VectorFormData {
  return { rules: [createEmptyRule(defaultElementName)] };
}

function createEmptyTemplate(defaultElementName = ""): TemplateFormData {
  return { name: "", vectors: [createEmptyVector(defaultElementName)] };
}

function templateToFormData(template: DetectionTemplateItem): TemplateFormData {
  return {
    name: template.name,
    vectors: template.vectors.map((v: DetectionTemplateItem["vectors"][number]) => ({
      rules: v.rules.map((r: DetectionTemplateItem["vectors"][number]["rules"][number]) => ({
        element_name: r.element_name,
        mode:
          r.range || (r.count_from != null && r.count_to != null)
            ? ("range" as const)
            : ("exact" as const),
        count: r.count ?? 1,
        count_from: r.count_from ?? 1,
        count_to: r.count_to ?? 2,
      })),
    })),
  };
}

function formDataToVectors(form: TemplateFormData): DetectionVectorDTO[] {
  return form.vectors.map((v) => ({
    rules: v.rules.map((r) => {
      if (r.mode === "range") {
        return {
          element_name: r.element_name,
          count_from: r.count_from,
          count_to: r.count_to,
        };
      }
      return {
        element_name: r.element_name,
        count: r.count,
      };
    }),
  }));
}

interface SettingsWindowProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsWindow({ open, onClose }: SettingsWindowProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("rules");
  const [pageNumber, setPageNumber] = useState(0);
  const pageSize = 8;

  const queryClient = useQueryClient();
  const { data: templatesData, isLoading: loading, error: rqError } = useDetectionTemplates(pageNumber, pageSize);
  const { data: detectedElements = [], isLoading: elementsLoading } = useDetectedElements();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const templates = templatesData?.content ?? [];
  const totalPages = templatesData?.page?.totalPages ?? 0;
  const totalElements = templatesData?.page?.totalElements ?? 0;
  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const error = rqError?.message ?? null;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateName, setEditingTemplateName] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(createEmptyTemplate());

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deleteTarget) {
          setDeleteTarget(null);
        } else if (editorOpen) {
          setEditorOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, editorOpen, deleteTarget, onClose]);

  const handlePrevious = () => {
    if (pageNumber > 0) setPageNumber(pageNumber - 1);
  };

  const handleNext = () => {
    if (pageNumber + 1 < totalPages) setPageNumber(pageNumber + 1);
  };

  const handleCreate = () => {
    setEditingTemplateName(null);
    setFormData(createEmptyTemplate(detectedElements[0] ?? ""));
    setEditorOpen(true);
  };

  const handleEdit = (template: DetectionTemplateItem) => {
    setEditingTemplateName(template.name);
    setFormData(templateToFormData(template));
    setEditorOpen(true);
  };

  const handleDelete = async (name: string) => {
    try {
      await deleteMutation.mutateAsync(name);
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["detection-rules"] });
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const handleSave = async () => {
    try {
      const vectors = formDataToVectors(formData);
      if (editingTemplateName) {
        await updateMutation.mutateAsync({
          name: editingTemplateName,
          new_name: formData.name !== editingTemplateName ? formData.name : undefined,
          vectors,
        });
      } else {
        await createMutation.mutateAsync({
          name: formData.name,
          vectors,
        });
      }
      setEditorOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["detection-rules"] });
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  const addVector = () => {
    setFormData((prev) => ({
      ...prev,
      vectors: [...prev.vectors, createEmptyVector(detectedElements[0] ?? "")],
    }));
  };

  const removeVector = (vectorIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      vectors: prev.vectors.filter((_, i) => i !== vectorIndex),
    }));
  };

  const addRule = (vectorIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      vectors: prev.vectors.map((v, i) =>
        i === vectorIndex
          ? {
              ...v,
              rules: [...v.rules, createEmptyRule(detectedElements[0] ?? "")],
            }
          : v,
      ),
    }));
  };

  const removeRule = (vectorIndex: number, ruleIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      vectors: prev.vectors.map((v, i) =>
        i === vectorIndex ? { ...v, rules: v.rules.filter((_, ri) => ri !== ruleIndex) } : v,
      ),
    }));
  };

  const updateRule = (vectorIndex: number, ruleIndex: number, updates: Partial<RuleFormData>) => {
    setFormData((prev) => ({
      ...prev,
      vectors: prev.vectors.map((v, i) =>
        i === vectorIndex
          ? {
              ...v,
              rules: v.rules.map((r, ri) => (ri === ruleIndex ? { ...r, ...updates } : r)),
            }
          : v,
      ),
    }));
  };

  if (!open) return null;

  const totalRows = 8;

  const summarizeRules = (template: DetectionTemplateItem) => {
    const allRules = template.vectors.flatMap((v: DetectionTemplateItem["vectors"][number]) => v.rules);
    if (allRules.length === 0) return "—";
    const parts = allRules.slice(0, 3).map((r: DetectionTemplateItem["vectors"][number]["rules"][number]) => {
      if (r.count_from != null && r.count_to != null) {
        return `${r.element_name} (${r.count_from}–${r.count_to})`;
      }
      return `${r.element_name} ×${r.count ?? "?"}`;
    });
    if (allRules.length > 3) parts.push(`+${allRules.length - 3} more`);
    return parts.join(", ");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && !editorOpen && !deleteTarget) onClose();
        }}
      >
        <Card className="border-border/50 flex max-h-[85vh] w-full max-w-4xl flex-col shadow-lg">
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <div className="flex items-center gap-4">
              <h2 className="text-foreground text-xl font-semibold">Settings</h2>
              <div className="bg-muted/40 inline-flex rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("rules")}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors",
                    activeTab === "rules"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Detection Rules
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("areas")}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors",
                    activeTab === "areas"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Forbidden Areas
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === "rules" && (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="bg-primary text-primary-foreground hover:bg-primary/80 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14m-7-7h14" />
                  </svg>
                  New Template
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <CardContent className="overflow-y-auto px-6 pb-4">
            {activeTab === "areas" ? (
              <ForbiddenAreasPanel />
            ) : (
              <>
            {error ? (
              <div className="mb-3 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="border-border/50 h-124 overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-muted/70 border-border/50">
                    <TableHead className="p-4 font-bold">Name</TableHead>
                    <TableHead className="w-24 p-4 text-center font-bold">Vectors</TableHead>
                    <TableHead className="p-4 font-bold">Rules</TableHead>
                    <TableHead className="w-24 p-4 text-center font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    if (loading) {
                      return Array.from({ length: totalRows }).map((_, index) => (
                        <TableRow key={`skeleton-${index}`} className="border-border/50 h-14.25">
                          <TableCell className="p-4">
                            <Skeleton className="h-5 w-32" />
                          </TableCell>
                          <TableCell className="p-4">
                            <Skeleton className="mx-auto h-5 w-8" />
                          </TableCell>
                          <TableCell className="p-4">
                            <Skeleton className="h-5 w-48" />
                          </TableCell>
                          <TableCell className="p-4">
                            <Skeleton className="mx-auto h-5 w-16" />
                          </TableCell>
                        </TableRow>
                      ));
                    }

                    if (templates.length === 0) {
                      return (
                        <>
                          <TableRow className="hover:bg-muted/30 border-border/50 h-14.25">
                            <TableCell colSpan={4} className="text-muted-foreground text-center">
                              No detection templates found
                            </TableCell>
                          </TableRow>
                          {Array.from({ length: totalRows - 1 }).map((_, index) => (
                            <TableRow
                              key={`empty-no-data-${index}`}
                              className="border-border/50 h-14.25"
                            >
                              <TableCell className="p-4" />
                              <TableCell className="p-4" />
                              <TableCell className="p-4" />
                              <TableCell className="p-4" />
                            </TableRow>
                          ))}
                        </>
                      );
                    }

                    const emptyRowsCount = Math.max(0, totalRows - templates.length);

                    return (
                      <>
                        {templates.map((template) => (
                          <TableRow
                            key={template.name}
                            className="hover:bg-muted/20 border-border/50 h-14.25"
                          >
                            <TableCell className="p-4 text-sm font-medium">
                              {template.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground p-4 text-center text-sm">
                              {template.vector_count}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-xs truncate p-4 text-sm">
                              {summarizeRules(template)}
                            </TableCell>
                            <TableCell className="p-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(template)}
                                  className="text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer rounded p-1.5 transition-colors"
                                  aria-label={`Edit ${template.name}`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(template.name)}
                                  className="text-muted-foreground cursor-pointer rounded p-1.5 transition-colors hover:bg-red-900/20 hover:text-red-400"
                                  aria-label={`Delete ${template.name}`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0" />
                                  </svg>
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {Array.from({ length: emptyRowsCount }).map((_, index) => (
                          <TableRow key={`empty-${index}`} className="border-border/50 h-14.25">
                            <TableCell className="p-4" />
                            <TableCell className="p-4" />
                            <TableCell className="p-4" />
                            <TableCell className="p-4" />
                          </TableRow>
                        ))}
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-muted-foreground text-sm">
                Showing {templates.length} of {totalElements} templates
              </div>

              <nav className="flex items-center gap-x-1" aria-label="Pagination">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={loading || pageNumber === 0}
                  className="inline-flex min-h-9.5 min-w-9.5 cursor-pointer items-center justify-center gap-x-2 rounded-lg px-2.5 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
                  aria-label="Previous"
                >
                  <svg
                    className="size-3.5 shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  <span className="sr-only">Previous</span>
                </button>
                <div className="flex items-center gap-x-1">
                  <span className="flex min-h-9.5 min-w-9.5 items-center justify-center rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200">
                    {pageNumber + 1}
                  </span>
                  <span className="flex min-h-9.5 items-center justify-center px-1.5 py-2 text-sm text-gray-500 dark:text-neutral-400">
                    of
                  </span>
                  <span className="flex min-h-9.5 items-center justify-center px-1.5 py-2 text-sm text-gray-500 dark:text-neutral-400">
                    {totalPages}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading || pageNumber >= totalPages - 1}
                  className="inline-flex min-h-9.5 min-w-9.5 cursor-pointer items-center justify-center gap-x-2 rounded-lg px-2.5 py-2 text-sm text-gray-800 hover:bg-gray-100 focus:bg-gray-100 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
                  aria-label="Next"
                >
                  <span className="sr-only">Next</span>
                  <svg
                    className="size-3.5 shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </nav>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rule Editor Modal */}
      {editorOpen && (
        <SettingsRuleCreator
          formData={formData}
          detectedElements={detectedElements}
          elementsLoading={elementsLoading}
          saving={saving}
          isEdit={editingTemplateName !== null}
          onFormChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
          onAddVector={addVector}
          onRemoveVector={removeVector}
          onAddRule={addRule}
          onRemoveRule={removeRule}
          onUpdateRule={updateRule}
          onSave={handleSave}
          onCancel={() => setEditorOpen(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <SettingsDeleteConfirmation
          name={deleteTarget}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
