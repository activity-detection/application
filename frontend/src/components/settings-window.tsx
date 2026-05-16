"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { DetectionVectorDTO } from "@/models";
import { useRules, type DetectionTemplateItem } from "@/contexts/rules";
import {
  SettingsRuleCreator,
  type RuleFormData,
  type TemplateFormData,
  type VectorFormData,
} from "@/components/settings-rule-creator";
import { SettingsDeleteConfirmation } from "@/components/settings-delete-confirmation";

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
    vectors: template.vectors.map((v) => ({
      rules: v.rules.map((r) => ({
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
  const {
    templates,
    detectedElements,
    loading,
    elementsLoading,
    saving,
    error,
    pageNumber,
    totalPages,
    totalElements,
    loadRulesPage,
    loadDetectedElements,
    createTemplate,
    updateTemplate,
    removeTemplate,
  } = useRules();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateName, setEditingTemplateName] = useState<string | null>(
    null,
  );
  const [formData, setFormData] = useState<TemplateFormData>(
    createEmptyTemplate(),
  );

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      void loadRulesPage(0);
      void loadDetectedElements();
    }
  }, [open, loadRulesPage, loadDetectedElements]);

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
    if (pageNumber > 0) void loadRulesPage(pageNumber - 1);
  };

  const handleNext = () => {
    if (pageNumber + 1 < totalPages) void loadRulesPage(pageNumber + 1);
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
      await removeTemplate(name);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const handleSave = async () => {
    try {
      const vectors = formDataToVectors(formData);
      if (editingTemplateName) {
        await updateTemplate({
          name: editingTemplateName,
          new_name:
            formData.name !== editingTemplateName ? formData.name : undefined,
          vectors,
        });
      } else {
        await createTemplate({
          name: formData.name,
          vectors,
        });
      }
      setEditorOpen(false);
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
        i === vectorIndex
          ? { ...v, rules: v.rules.filter((_, ri) => ri !== ruleIndex) }
          : v,
      ),
    }));
  };

  const updateRule = (
    vectorIndex: number,
    ruleIndex: number,
    updates: Partial<RuleFormData>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      vectors: prev.vectors.map((v, i) =>
        i === vectorIndex
          ? {
              ...v,
              rules: v.rules.map((r, ri) =>
                ri === ruleIndex ? { ...r, ...updates } : r,
              ),
            }
          : v,
      ),
    }));
  };

  if (!open) return null;

  const totalRows = 8;

  const summarizeRules = (template: DetectionTemplateItem) => {
    const allRules = template.vectors.flatMap((v) => v.rules);
    if (allRules.length === 0) return "—";
    const parts = allRules.slice(0, 3).map((r) => {
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
        className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !editorOpen && !deleteTarget)
            onClose();
        }}
      >
        <Card className="w-full max-w-4xl max-h-[85vh] border-border/50 shadow-lg flex flex-col">
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <h2 className="text-xl font-semibold text-foreground">
              Detection Rules Settings
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreate}
                className="cursor-pointer inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/80 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
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
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
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

          <CardContent className="px-6 pb-4 overflow-y-auto">
            {error ? (
              <div className="mb-3 rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="h-124 rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-muted/70 border-border/50">
                    <TableHead className="p-4 font-bold">Name</TableHead>
                    <TableHead className="p-4 font-bold w-24 text-center">
                      Vectors
                    </TableHead>
                    <TableHead className="p-4 font-bold">Rules</TableHead>
                    <TableHead className="p-4 font-bold w-24 text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    if (loading) {
                      return Array.from({ length: totalRows }).map(
                        (_, index) => (
                          <TableRow
                            key={`skeleton-${index}`}
                            className="border-border/50 h-14.25"
                          >
                            <TableCell className="p-4">
                              <Skeleton className="h-5 w-32" />
                            </TableCell>
                            <TableCell className="p-4">
                              <Skeleton className="h-5 w-8 mx-auto" />
                            </TableCell>
                            <TableCell className="p-4">
                              <Skeleton className="h-5 w-48" />
                            </TableCell>
                            <TableCell className="p-4">
                              <Skeleton className="h-5 w-16 mx-auto" />
                            </TableCell>
                          </TableRow>
                        ),
                      );
                    }

                    if (templates.length === 0) {
                      return (
                        <>
                          <TableRow className="hover:bg-muted/30 border-border/50 h-14.25">
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground"
                            >
                              No detection templates found
                            </TableCell>
                          </TableRow>
                          {Array.from({ length: totalRows - 1 }).map(
                            (_, index) => (
                              <TableRow
                                key={`empty-no-data-${index}`}
                                className="border-border/50 h-14.25"
                              >
                                <TableCell className="p-4" />
                                <TableCell className="p-4" />
                                <TableCell className="p-4" />
                                <TableCell className="p-4" />
                              </TableRow>
                            ),
                          )}
                        </>
                      );
                    }

                    const emptyRowsCount = Math.max(
                      0,
                      totalRows - templates.length,
                    );

                    return (
                      <>
                        {templates.map((template) => (
                          <TableRow
                            key={template.name}
                            className="hover:bg-muted/20 border-border/50 h-14.25"
                          >
                            <TableCell className="p-4 font-medium text-sm">
                              {template.name}
                            </TableCell>
                            <TableCell className="p-4 text-sm text-center text-muted-foreground">
                              {template.vector_count}
                            </TableCell>
                            <TableCell className="p-4 text-sm text-muted-foreground truncate max-w-xs">
                              {summarizeRules(template)}
                            </TableCell>
                            <TableCell className="p-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(template)}
                                  className="cursor-pointer p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                  aria-label={`Edit ${template.name}`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4"
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
                                  className="cursor-pointer p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-900/20 transition-colors"
                                  aria-label={`Delete ${template.name}`}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4"
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
                        {Array.from({ length: emptyRowsCount }).map(
                          (_, index) => (
                            <TableRow
                              key={`empty-${index}`}
                              className="border-border/50 h-14.25"
                            >
                              <TableCell className="p-4" />
                              <TableCell className="p-4" />
                              <TableCell className="p-4" />
                              <TableCell className="p-4" />
                            </TableRow>
                          ),
                        )}
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Showing {templates.length} of {totalElements} templates
              </div>

              <nav
                className="flex items-center gap-x-1"
                aria-label="Pagination"
              >
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={loading || pageNumber === 0}
                  className="cursor-pointer min-h-9.5 min-w-9.5 py-2 px-2.5 inline-flex justify-center items-center gap-x-2 text-sm rounded-lg text-gray-800 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700 focus:outline-hidden focus:bg-gray-100 dark:focus:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Previous"
                >
                  <svg
                    className="shrink-0 size-3.5"
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
                  <span className="min-h-9.5 min-w-9.5 flex justify-center items-center border border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200 py-2 px-3 text-sm rounded-lg focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none">
                    {pageNumber + 1}
                  </span>
                  <span className="min-h-9.5 flex justify-center items-center text-gray-500 dark:text-neutral-400 py-2 px-1.5 text-sm">
                    of
                  </span>
                  <span className="min-h-9.5 flex justify-center items-center text-gray-500 dark:text-neutral-400 py-2 px-1.5 text-sm">
                    {totalPages}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading || pageNumber >= totalPages - 1}
                  className="cursor-pointer min-h-9.5 min-w-9.5 py-2 px-2.5 inline-flex justify-center items-center gap-x-2 text-sm rounded-lg text-gray-800 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-700 focus:outline-hidden focus:bg-gray-100 dark:focus:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none"
                  aria-label="Next"
                >
                  <span className="sr-only">Next</span>
                  <svg
                    className="shrink-0 size-3.5"
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
          onFormChange={(updates) =>
            setFormData((prev) => ({ ...prev, ...updates }))
          }
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
