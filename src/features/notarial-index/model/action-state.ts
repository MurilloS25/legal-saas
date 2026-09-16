export type NotarialMetadataState = {
  errors?: Partial<Record<string, string>>;
  message?: string;
  success?: boolean;
  successMessage?: string;
  resetParties?: boolean;
};

export type TemplateIndexConfigurationState = {
  errors?: Partial<Record<string, string>>;
  message?: string;
  success?: boolean;
};
