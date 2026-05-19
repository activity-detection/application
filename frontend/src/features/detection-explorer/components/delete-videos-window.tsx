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

  const canConfirm = useMemo(() => confirmationText.trim() === "DELETE", [confirmationText]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="border-border/50 w-full max-w-md shadow-lg">
        <CardContent className="space-y-4 px-4 py-1">
          <div className="space-y-1">
            <h2 className="text-foreground text-lg font-semibold">Confirmation</h2>
            <p className="text-muted-foreground text-sm">
              Are you sure you want to delete the ({selectedCount}) selected videos?
            </p>
            <p className="text-muted-foreground text-sm">
              Type <span className="text-foreground font-semibold">&quot;DELETE&quot;</span> to
              confirm the deletion:
            </p>
          </div>

          <input
            type="text"
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            placeholder="DELETE"
            className="border-border bg-background focus-visible:border-ring h-10 w-full rounded-lg border px-3 text-sm outline-none"
            aria-label="Type DELETE to confirm"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="border-border bg-muted text-muted-foreground hover:bg-muted/80 inline-flex h-10 cursor-pointer items-center rounded-lg border px-4 text-sm"
            >
              No
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="text-foreground inline-flex h-10 cursor-pointer items-center rounded-lg border bg-red-900/70 px-4 text-sm hover:bg-red-900/80 disabled:pointer-events-none disabled:opacity-50"
            >
              Yes
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
