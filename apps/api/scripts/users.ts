/**
 * Manage users from the terminal (until the Users page exists, and as a rescue if every admin
 * forgets their password):
 *
 *   pnpm user:create            add a user (asks for username, name, role, password)
 *   pnpm user:reset-password    set a new password (also logs that user out everywhere)
 *
 * Uses DATABASE_URL from apps/api/.env. Changes are written to the audit log as "Terminal (CLI)".
 */
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import {
  displayNameSchema,
  newPasswordSchema,
  ROLES,
  usernameSchema,
  type Role,
} from "@pos/shared";
import type { z } from "zod";
import type { AuditActor } from "../src/audit/audit";
import { HttpError } from "../src/lib/http-error";
import { prisma } from "../src/lib/prisma";
import type { RequestMeta } from "../src/lib/request-meta";
import { createUser, resetPassword } from "../src/modules/users/users.service";

const CLI_ACTOR: AuditActor = { userId: null, userName: "Terminal (CLI)", role: "SYSTEM" };
const CLI_META: RequestMeta = { ip: null, userAgent: "pos-cli", terminalId: null };

const ROLE_LABELS: Record<Role, string> = { ADMIN: "admin", CASHIER: "cashier" };

/**
 * Reads answers line by line (works when typing and when input is piped in).
 * Hidden answers (passwords) aren't echoed when the terminal allows it; Git Bash (mintty) isn't a
 * real console, so there they stay visible — clear the screen afterwards if anyone is watching.
 */
class Prompter {
  readonly canHide = Boolean(stdin.isTTY);
  private readonly echo = new EchoStream();
  private readonly rl = createInterface({
    input: stdin,
    output: this.echo,
    terminal: this.canHide,
  });
  private readonly lines = this.rl[Symbol.asyncIterator]();

  async line(question: string, hidden = false): Promise<string> {
    stdout.write(hidden && !this.canHide ? `${question}(visible) ` : question);
    this.echo.muted = hidden && this.canHide;
    try {
      const next = await this.lines.next();
      if (next.done) throw new CancelledError();
      return next.value;
    } finally {
      if (this.echo.muted) stdout.write("\n");
      this.echo.muted = false;
    }
  }

  async ask<T>(question: string, schema: z.ZodType<T>, hidden = false): Promise<T> {
    for (;;) {
      const result = schema.safeParse(await this.line(question, hidden));
      if (result.success) return result.data;
      console.log(`  ✗ ${result.error.issues[0]?.message ?? "Invalid value"}`);
    }
  }

  close() {
    this.rl.close();
  }
}

/** Where readline echoes what is typed; muted while a password is typed. */
class EchoStream extends Writable {
  muted = false;
  override _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void) {
    if (!this.muted) stdout.write(chunk);
    done();
  }
}

class CancelledError extends Error {}

async function askPasswordTwice(prompt: Prompter): Promise<string> {
  for (;;) {
    const password = await prompt.ask("Password (8+ characters): ", newPasswordSchema, true);
    const again = await prompt.line("Type it again: ", true);
    if (password === again) return password;
    console.log("  ✗ The two passwords don't match. Try again.");
  }
}

/** Ask until the username is free (new user) or exists (reset), so nobody types passwords for nothing. */
async function askUsername(
  prompt: Prompter,
  question: string,
  mustExist: boolean,
): Promise<string> {
  for (;;) {
    const username = await prompt.ask(question, usernameSchema);
    const exists = (await prisma.user.count({ where: { username } })) > 0;
    if (exists === mustExist) return username;
    console.log(
      mustExist ? `  ✗ No user named "${username}".` : `  ✗ "${username}" is already taken.`,
    );
  }
}

async function askRole(prompt: Prompter): Promise<Role> {
  for (;;) {
    const answer = (await prompt.line("Role — cashier or admin [cashier]: ")).trim().toLowerCase();
    if (answer === "") return "CASHIER";
    const role = ROLES.find((r) => ROLE_LABELS[r] === answer);
    if (role) return role;
    console.log('  ✗ Type "cashier" or "admin".');
  }
}

async function create(prompt: Prompter) {
  console.log("Add a user\n");
  const username = await askUsername(prompt, "Username (for logging in): ", false);
  const displayName = await prompt.ask("Name shown in the app: ", displayNameSchema);
  const role = await askRole(prompt);
  const password = await askPasswordTwice(prompt);

  const user = await createUser({ username, displayName, role, password }, CLI_ACTOR, CLI_META);
  console.log(
    `\n✅ Added ${user.displayName} (${ROLE_LABELS[user.role]}). Log in as "${user.username}".`,
  );
}

async function reset(prompt: Prompter) {
  console.log("Reset a password\n");
  const username = await askUsername(prompt, "Username: ", true);
  const password = await askPasswordTwice(prompt);

  const user = await resetPassword(username, password, CLI_ACTOR, CLI_META);
  console.log(
    `\n✅ New password set for ${user.displayName}. They were logged out on every device.`,
  );
}

const COMMANDS = { create, "reset-password": reset } as const;

async function main() {
  const name = process.argv[2] as keyof typeof COMMANDS | undefined;
  const command = name ? COMMANDS[name] : undefined;
  if (!command) {
    console.error("Usage: pnpm user:create | pnpm user:reset-password");
    process.exitCode = 1;
    return;
  }

  const prompt = new Prompter();
  try {
    await command(prompt);
  } catch (error) {
    if (error instanceof HttpError) {
      console.error(`\n✗ ${error.message}`);
      process.exitCode = 1;
    } else if (error instanceof CancelledError) {
      console.error("\nCancelled, nothing was changed.");
      process.exitCode = 1;
    } else {
      throw error;
    }
  } finally {
    prompt.close();
    await prisma.$disconnect();
  }
}

await main();
