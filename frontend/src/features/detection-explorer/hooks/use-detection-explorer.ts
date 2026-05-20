import { useDetectionExplorerStore } from "@/features/detection-explorer/stores/detection-explorer.store";

export function useDetectionExplorer() {
  return useDetectionExplorerStore();
}
