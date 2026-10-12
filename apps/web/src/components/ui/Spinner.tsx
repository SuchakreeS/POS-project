import { IconLoader2 } from "@tabler/icons-react";
import { clsx } from "clsx";

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return <IconLoader2 size={size} className={clsx("animate-spin", className)} aria-hidden />;
}
