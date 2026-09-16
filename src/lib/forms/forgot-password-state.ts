export type ForgotPasswordState = {
  errors?: {
    email?: string;
  };
  message?: string;
  submitted?: boolean;
};
