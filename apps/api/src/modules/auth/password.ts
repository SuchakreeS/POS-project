import bcrypt from "bcryptjs";
import { AUTH } from "../../config";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, AUTH.bcryptRounds);
}

// A real bcrypt hash of a random value. Checking against it when the username doesn't exist
// makes "unknown user" take as long as "wrong password", so timing can't reveal usernames.
const DUMMY_HASH = "$2b$12$Q8JUjK1.n3rXSA0.D1dN7OTe9PwX43veQBLFiQiQpu5/X60/SxbiO";

export function verifyPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
