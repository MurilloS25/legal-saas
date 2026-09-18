export type ClientState = {
  errors?: {
    full_name?: string;
    identification_type?: string;
    identification_number?: string;
    marital_status?: string;
    nationality?: string;
    occupation?: string;
    exact_address?: string;
  };
  message?: string;
  success?: boolean;
};

export type DeleteClientState = {
  message?: string;
};

/** Cliente mínimo que devuelve la creación contextual (diálogo). */
export type CreatedClient = {
  id: string;
  full_name: string;
  identification_number: string;
  exact_address: string;
};

export type ClientDialogState = ClientState & {
  client?: CreatedClient;
};
