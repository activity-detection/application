"use client";

import { Card, CardContent } from "@/components/ui/card";

export type RuleFormData = {
  element_name: string;
  mode: "exact" | "range";
  count: number;
  count_from: number;
  count_to: number;
};

export type VectorFormData = {
  rules: RuleFormData[];
};

export type TemplateFormData = {
  name: string;
  vectors: VectorFormData[];
};

function isFormValid(form: TemplateFormData): boolean {
  if (!form.name.trim()) return false;
  if (form.vectors.length === 0) return false;
  return form.vectors.every(
    (v) =>
      v.rules.length > 0 &&
      v.rules.every((r) => {
        if (!r.element_name.trim()) return false;
        if (r.mode === "exact" && r.count < 1) return false;
        if (
          r.mode === "range" &&
          (r.count_from < 0 || r.count_to < r.count_from)
        ) {
          return false;
        }
        return true;
      }),
  );
}

type SettingsRuleCreatorProps = {
  formData: TemplateFormData;
  detectedElements: string[];
  elementsLoading: boolean;
  saving: boolean;
  isEdit: boolean;
  onFormChange: (data: Partial<TemplateFormData>) => void;
  onAddVector: () => void;
  onRemoveVector: (vectorIndex: number) => void;
  onAddRule: (vectorIndex: number) => void;
  onRemoveRule: (vectorIndex: number, ruleIndex: number) => void;
  onUpdateRule: (
    vectorIndex: number,
    ruleIndex: number,
    updates: Partial<RuleFormData>,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function SettingsRuleCreator({
  formData,
  detectedElements,
  elementsLoading,
  saving,
  isEdit,
  onFormChange,
  onAddVector,
  onRemoveVector,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
  onSave,
  onCancel,
}: SettingsRuleCreatorProps) {
  const valid = isFormValid(formData);

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center backdrop-blur-xs bg-black/30 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <Card className="w-full max-w-2xl max-h-[85vh] border-border/50 shadow-lg flex flex-col">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit Template" : "New Template"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
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

        <CardContent className="px-4 pb-4 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
              placeholder="e.g. crowd-detection"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring"
            />
          </div>

          <div className="space-y-3">
            {formData.vectors.map((vector, vi) => (
              <div
                key={vi}
                className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/30">
                  <span className="text-sm font-medium text-foreground">
                    Vector {vi + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onAddRule(vi)}
                      className="cursor-pointer inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 5v14m-7-7h14" />
                      </svg>
                      Rule
                    </button>
                    {formData.vectors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveVector(vi)}
                        className="cursor-pointer inline-flex items-center rounded px-1.5 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-3 py-2 space-y-2">
                  {vector.rules.map((rule, ri) => (
                    <div key={ri} className="flex items-center gap-2">
                      <select
                        value={rule.element_name}
                        onChange={(e) =>
                          onUpdateRule(vi, ri, { element_name: e.target.value })
                        }
                        disabled={elementsLoading}
                        className="h-8 flex-1 min-w-0 rounded border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring"
                      >
                        <option value="" disabled>
                          {elementsLoading
                            ? "Loading elements..."
                            : "Select element"}
                        </option>
                        {rule.element_name &&
                        !detectedElements.includes(rule.element_name) ? (
                          <option value={rule.element_name}>
                            {rule.element_name}
                          </option>
                        ) : null}
                        {detectedElements.map((elementName) => (
                          <option key={elementName} value={elementName}>
                            {elementName}
                          </option>
                        ))}
                      </select>

                      <select
                        value={rule.mode}
                        onChange={(e) =>
                          onUpdateRule(vi, ri, {
                            mode: e.target.value as "exact" | "range",
                          })
                        }
                        className="h-8 rounded border border-border bg-background px-2 text-sm outline-none focus-visible:border-ring cursor-pointer"
                      >
                        <option value="exact">exact</option>
                        <option value="range">range</option>
                      </select>

                      {rule.mode === "exact" ? (
                        <input
                          type="number"
                          min={1}
                          value={rule.count}
                          onChange={(e) =>
                            onUpdateRule(vi, ri, {
                              count: parseInt(e.target.value) || 0,
                            })
                          }
                          className="h-8 w-16 rounded border border-border bg-background px-2 text-sm text-center outline-none focus-visible:border-ring"
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={rule.count_from}
                            onChange={(e) =>
                              onUpdateRule(vi, ri, {
                                count_from: parseInt(e.target.value) || 0,
                              })
                            }
                            className="h-8 w-14 rounded border border-border bg-background px-2 text-sm text-center outline-none focus-visible:border-ring"
                          />
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={rule.count_to}
                            onChange={(e) =>
                              onUpdateRule(vi, ri, {
                                count_to: parseInt(e.target.value) || 0,
                              })
                            }
                            className="h-8 w-14 rounded border border-border bg-background px-2 text-sm text-center outline-none focus-visible:border-ring"
                          />
                        </div>
                      )}

                      {vector.rules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveRule(vi, ri)}
                          className="cursor-pointer text-red-400 hover:text-red-300 transition-colors p-0.5"
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
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={onAddVector}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors w-full justify-center"
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
              Add Vector
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer inline-flex h-10 items-center rounded-lg border border-border bg-muted px-4 text-sm text-muted-foreground hover:bg-muted/80"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid || saving}
              onClick={onSave}
              className="cursor-pointer inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/80 disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
