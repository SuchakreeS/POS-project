import type { Role } from "@pos/shared";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth: who is calling, from the access token. */
      auth?: {
        userId: string;
        role: Role;
        displayName: string;
      };
    }
  }
}

export {};
