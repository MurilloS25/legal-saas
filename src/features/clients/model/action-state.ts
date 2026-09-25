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

/**
 * Cliente que devuelve la creación contextual (diálogo): incluye todos los
 * datos copiables por el autollenado de roles, para que un Cliente recién
 * creado desde una Escritura rellene lo mismo que uno ya existente.
 */
export type CreatedClient = {
  id: string;
  identification_type: string;
  full_name: string;
  identification_number: string;
  exact_address: string;
  marital_status: string | null;
  occupation: string | null;
  nationality: string | null;
};

export type ClientDialogState = ClientState & {
  client?: CreatedClient;
};
