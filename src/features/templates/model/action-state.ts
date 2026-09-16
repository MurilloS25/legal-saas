export type TemplateWorkspaceState = {
  errors?: {
    name?: string;
    description?: string;
    status?: string;
    document?: string;
    variables?: string;
  };
  message?: string;
  success?: boolean;
  updatedAt?: string;
};
