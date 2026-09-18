import type { WorkspaceRole } from "@/lib/server/permissions";

export type DocumentSettingsData = {
  font_family: string;
  font_size: number;
  margin_top_cm: number;
  margin_bottom_cm: number;
  margin_left_cm: number;
  margin_right_cm: number;
  /** Vuelto; `null` en filas anteriores a Frente/Vuelto (= mismos que Frente). */
  back_margin_top_cm: number | null;
  back_margin_bottom_cm: number | null;
  back_margin_left_cm: number | null;
  back_margin_right_cm: number | null;
};

export type LawyerProfileData = {
  full_name: string;
  professional_code: string | null;
  email: string | null;
  phone: string | null;
};

export type TeamMember = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  status: string;
  invited_by: string | null;
  created_at: string;
};

export type SettingsTeamData = {
  canManageMembers: boolean;
  members: TeamMember[];
  activity: WorkspaceActivityEvent[];
  callerUserId: string;
  callerRole: WorkspaceRole;
};

export type WorkspaceActivityEvent = {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name_snapshot: string;
  actor_role_snapshot: string;
  target_email: string | null;
};
