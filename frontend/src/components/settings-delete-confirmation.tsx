"use client";

import { Card, CardContent } from "@/components/ui/card";

type SettingsDeleteConfirmationProps = {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SettingsDeleteConfirmation({
  name,
  onConfirm,
  onCancel,
}: SettingsDeleteConfirmationProps) {
  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center backdrop-blur-xs bg-black/30 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <Card className="w-full max-w-sm border-border/50 shadow-lg">
        <CardContent className="space-y-4 px-4 py-1">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Delete Template
            </h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{name}</span>?
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer inline-flex h-10 items-center rounded-lg border border-border bg-muted px-4 text-sm text-muted-foreground hover:bg-muted/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="cursor-pointer inline-flex h-10 items-center rounded-lg border bg-red-900/70 px-4 text-sm text-foreground hover:bg-red-900/80"
            >
              Delete
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
