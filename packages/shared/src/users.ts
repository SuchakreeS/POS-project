import { z } from "zod";
import {
  displayNameSchema,
  newPasswordSchema,
  ROLES,
  usernameSchema,
  type AuthUser,
  type Role,
} from "./auth";

/*
 * Users page (plan.md → Users page). Admin only. Users are never deleted, only turned off,
 * because sales, voids and the audit log point to them.
 */

export const ROLE_LABELS: Record<Role, string> = { ADMIN: "Admin", CASHIER: "Cashier" };

/** One line under each role in the Add / Edit dialog. */
export const ROLE_HINTS: Record<Role, string> = {
  CASHIER: "Sales, stock, credit, orders and reports",
  ADMIN: "Everything, plus users and settings",
};

const profileFields = {
  displayName: displayNameSchema,
  username: usernameSchema,
  role: z.enum(ROLES, { error: "Pick a role" }),
};

/** POST /users (the confirm-password check happens in the form). */
export const userCreateSchema = z.object({ ...profileFields, password: newPasswordSchema });
export type UserCreateInput = z.input<typeof userCreateSchema>;

/** PATCH /users/:id — passwords change only through reset. */
export const userUpdateSchema = z.object(profileFields);
export type UserUpdateInput = z.input<typeof userUpdateSchema>;

/** POST /users/:id/reset-password */
export const passwordResetSchema = z.object({ password: newPasswordSchema });
export type PasswordResetInput = z.input<typeof passwordResetSchema>;

/** A row of the Users page. */
export interface ManagedUser extends AuthUser {
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserList {
  items: ManagedUser[];
}
