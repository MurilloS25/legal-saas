import {
  formatWorkspaceActivityEvent,
  formatWorkspaceActivityTimestamp,
  type WorkspaceActivityEvent,
} from "./activity-format";

type Props = {
  events: WorkspaceActivityEvent[];
};

export function WorkspaceActivityList({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">Todavía no hay actividad.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Actividad</h2>
      <ol role="list" className="divide-y divide-slate-100">
        {events.map((event) => (
          <li key={event.id} className="py-3">
            <p className="text-sm text-slate-900">
              <span className="font-medium">{event.actor_name_snapshot}</span>{" "}
              {formatWorkspaceActivityEvent(event)}
            </p>
            <time
              dateTime={event.created_at}
              className="text-xs text-slate-400"
            >
              {formatWorkspaceActivityTimestamp(event.created_at)}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}
