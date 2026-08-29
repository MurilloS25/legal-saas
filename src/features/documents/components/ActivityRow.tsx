/**
 * Fila presentacional de un evento de actividad. Sin estado ni "use client":
 * se renderiza en el servidor (lista inicial) y también dentro de la isla
 * cliente de "Cargar más".
 */

import type { ActivityListItem } from "../server/activity-queries";
import {
  formatActivityEvent,
  formatActivityTimestamp,
} from "../model/activity-format";

export function ActivityRow({ item }: { item: ActivityListItem }) {
  const formatted = formatActivityEvent(item);
  return (
    <li className="px-6 py-4">
      <h3 className="text-sm font-medium text-ink-900">{formatted.title}</h3>
      {formatted.lines.map((line, index) => (
        <p key={index} className="text-sm text-ink-500">
          {line}
        </p>
      ))}
      <p className="mt-1 text-xs text-ink-400 tabular-figures">
        <time dateTime={item.created_at}>
          {formatActivityTimestamp(item.created_at)}
        </time>
        {" · "}
        {item.actorName}
      </p>
    </li>
  );
}
