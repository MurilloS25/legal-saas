export type ProfileState = {
  errors?: {
    full_name?: string;
    professional_code?: string;
    email?: string;
    phone?: string;
  };
  message?: string;
  success?: boolean;
};

export type DocumentSettingsState = {
  errors?: {
    font_family?: string;
    font_size?: string;
    margin_top_cm?: string;
    margin_bottom_cm?: string;
    margin_left_cm?: string;
    margin_right_cm?: string;
    back_margin_top_cm?: string;
    back_margin_bottom_cm?: string;
    back_margin_left_cm?: string;
    back_margin_right_cm?: string;
  };
  message?: string;
  success?: boolean;
};

export type InviteMemberState = {
  errors?: {
    email?: string;
    role?: string;
  };
  message?: string;
  success?: boolean;
};

export type TeamMemberActionState = {
  message?: string;
};
