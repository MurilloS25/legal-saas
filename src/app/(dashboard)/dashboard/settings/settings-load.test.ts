import { describe, expect, it } from "vitest";
import { DataAccessError } from "@/lib/server/errors";
import { resolveSettingsLoad } from "./settings-load";

const success = <T>(data: T | null) => ({ data, error: null });
const failure = { data: null, error: { code: "08006" } };

describe("resolveSettingsLoad", () => {
  it.each(["profile", "settings"] as const)(
    "rejects a failed %s read instead of returning editable defaults",
    (failedQuery) => {
      expect(() =>
        resolveSettingsLoad({
          needsTeam: false,
          profileResult: failedQuery === "profile" ? failure : success(null),
          settingsResult: failedQuery === "settings" ? failure : success(null),
          membersResult: success(null),
          activityResult: success(null),
        }),
      ).toThrow(DataAccessError);
    },
  );

  it("preserves legitimate missing profile and settings rows", () => {
    expect(
      resolveSettingsLoad({
        needsTeam: false,
        profileResult: success(null),
        settingsResult: success(null),
        membersResult: success(null),
        activityResult: success(null),
      }),
    ).toEqual({ profile: null, settings: null, members: [], activity: [] });
  });

  it("rejects team query failures only when team data was requested", () => {
    expect(() =>
      resolveSettingsLoad({
        needsTeam: true,
        profileResult: success(null),
        settingsResult: success(null),
        membersResult: failure,
        activityResult: success([]),
      }),
    ).toThrow(DataAccessError);
  });
});
