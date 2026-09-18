"use client";

import { SidePanelDialog } from "@/components/ui/SidePanelDialog";
import type { ReceivableActivityEvent } from "../model/activity-format";
import {
  formatReceivableActivityEvent,
  formatReceivableActivityTimestamp,
} from "../model/activity-format";

type Props = {
  activity: ReceivableActivityEvent[];
  currency: string;
};

export function ReceivableHistoryDialog({ activity, currency }: Props) {
  return (
    <SidePanelDialog title="Historial de la cuenta" closeLabel="Cerrar historial">
      {activity.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
                <p className="text-sm text-slate-500">
                  Todavía no hay actividad.
                </p>
              </div>
            ) : (
              <ol
                role="list"
                className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100 overflow-hidden"
              >
                {activity.map((event) => {
                  const formatted = formatReceivableActivityEvent(
                    event,
                    currency,
                  );
                  return (
                    <li key={event.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {formatted.title}
                          </p>
                          {formatted.lines.map((line, i) => (
                            <p key={i} className="text-xs text-slate-500">
                              {line}
                            </p>
                          ))}
                        </div>
                        <time
                          dateTime={event.created_at}
                          className="shrink-0 text-xs text-slate-400"
                        >
                          {formatReceivableActivityTimestamp(event.created_at)}
                        </time>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {event.actorName}
                      </p>
                    </li>
                  );
                })}
              </ol>
      )}
    </SidePanelDialog>
  );
}
