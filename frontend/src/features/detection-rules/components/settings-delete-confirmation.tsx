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
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <Card className="border-border/50 w-full max-w-sm shadow-lg">
        <CardContent className="space-y-4 px-4 py-1">
          <div className="space-y-1">
            <h2 className="text-foreground text-lg font-semibold">Delete Template</h2>
            <p className="text-muted-foreground text-sm">
              Are you sure you want to delete{" "}
              <span className="text-foreground font-semibold">{name}</span>?
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="border-border bg-muted text-muted-foreground hover:bg-muted/80 inline-flex h-10 cursor-pointer items-center rounded-lg border px-4 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="text-foreground inline-flex h-10 cursor-pointer items-center rounded-lg border bg-red-900/70 px-4 text-sm hover:bg-red-900/80"
            >
              Delete
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
