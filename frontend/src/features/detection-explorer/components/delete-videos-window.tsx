"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface DeleteVideosComponentProps {
  open: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteVideosComponent({
  open,
  selectedCount,
  onClose,
  onConfirm,
}: DeleteVideosComponentProps) {
  const [confirmationText, setConfirmationText] = useState("");

  const handleClose = () => {
    setConfirmationText("");
    onClose();
  };

  const handleConfirm = () => {
    setConfirmationText("");
    onConfirm();
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmationText("");
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  const canConfirm = useMemo(
    () => confirmationText.trim() === "DELETE",
    [confirmationText],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardContent className="space-y-4 px-4 py-1">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Confirmation
            </h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the ({selectedCount}) selected
              videos?
            </p>
            <p className="text-sm text-muted-foreground">
              Type{" "}
              <span className="font-semibold text-foreground">
                &quot;DELETE&quot;
              </span>{" "}
              to confirm the deletion:
            </p>
          </div>

          <input
            type="text"
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            placeholder="DELETE"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring"
            aria-label="Type DELETE to confirm"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-muted px-4 text-sm text-muted-foreground hover:bg-muted/80 cursor-pointer"
            >
              No
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="inline-flex h-10 items-center rounded-lg border bg-red-900/70 px-4 text-sm text-foreground hover:bg-red-900/80 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              Yes
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
