"use client";

import { SidePanelDialog } from "@/components/ui/SidePanelDialog";
import type { DocumentActivityPage } from "../server/activity-queries";
import { DocumentActivity } from "./DocumentActivity";

type Props = {
  documentId: string;
  activity: DocumentActivityPage;
};

export function DocumentHistoryDialog({ documentId, activity }: Props) {
  return (
    <SidePanelDialog
      title="Historial de la escritura"
      closeLabel="Cerrar historial"
    >
      <DocumentActivity
        documentId={documentId}
        initialItems={activity.items}
        initialHasMore={activity.hasMore}
        initialNextOffset={activity.nextOffset}
      />
    </SidePanelDialog>
  );
}
