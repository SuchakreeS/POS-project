import { z } from "zod";

/** User roles (plan.md → Roles). Cashier runs the shop; Admin also manages users and settings. */
export const ROLES = ["ADMIN", "CASHIER"] as const;
export type Role = (typeof ROLES)[number];

export const USERNAME_MAX = 50;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

/** New usernames: 3–50 characters, lowercase letters, numbers, dot, dash, underscore. Stored lowercase. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username needs at least 3 characters")
  .max(USERNAME_MAX, "Username is too long")
  .regex(/^[a-z0-9._-]+$/, "Use only letters, numbers, dot, dash or underscore");

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password needs at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, "Password is too long");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(60, "Name is too long");

/** Login form / POST /auth/login body. Username is case-insensitive (stored lowercase). */
export const loginInputSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your username")
    .max(USERNAME_MAX, "Username is too long"),
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, "Password is too long"),
});
export type LoginInput = z.input<typeof loginInputSchema>;

/** The signed-in user as the web app sees it. */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}

/** Returned by POST /auth/login and POST /auth/refresh. The refresh token travels in an httpOnly cookie. */
export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
