export interface LoginRequest {
  email: string;
  password: string;
  device_name: string;
}

export interface AuthClinic {
  id: number;
  name: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  clinic: AuthClinic | null;
  roles: string[];
  permissions: string[];
  last_login_at: string | null;
}

export interface LoginResponse {
  message: string;
  token_type: string;
  access_token: string;
  user: AuthUser;
}

/** Respons 422 dari Laravel, mis. kredensial salah. */
export interface ApiValidationError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface MeResponse {
  user: AuthUser;
}

export interface MessageResponse {
  message: string;
}
