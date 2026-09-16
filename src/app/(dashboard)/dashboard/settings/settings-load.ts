import "server-only";

import { throwDataAccessError } from "@/lib/server/errors";

type QueryError = { code?: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };

export function resolveSettingsLoad<Profile, Settings, Member, Activity>({
  needsTeam,
  profileResult,
  settingsResult,
  membersResult,
  activityResult,
}: {
  needsTeam: boolean;
  profileResult: QueryResult<Profile>;
  settingsResult: QueryResult<Settings>;
  membersResult: QueryResult<Member[]>;
  activityResult: QueryResult<Activity[]>;
}) {
  if (profileResult.error) {
    throwDataAccessError("load settings profile", profileResult.error);
  }
  if (settingsResult.error) {
    throwDataAccessError("load document settings", settingsResult.error);
  }
  if (needsTeam && membersResult.error) {
    throwDataAccessError("load settings members", membersResult.error);
  }
  if (needsTeam && activityResult.error) {
    throwDataAccessError("load settings activity", activityResult.error);
  }

  return {
    profile: profileResult.data,
    settings: settingsResult.data,
    members: needsTeam ? (membersResult.data ?? []) : [],
    activity: needsTeam ? (activityResult.data ?? []) : [],
  };
}
