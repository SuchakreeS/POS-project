import type { TablerIcon } from "@tabler/icons-react";
import { clsx } from "clsx";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";

/** "…" style menu (plan.md → Menus). `trigger` must be a button. */
export function Menu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 min-w-48 rounded-2xl border-2 border-border bg-page p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({
  icon: Icon,
  danger,
  disabled,
  onSelect,
  children,
}: {
  icon: TablerIcon;
  danger?: boolean;
  /** Shown but can't be picked (say why in the label or a hint nearby). */
  disabled?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={clsx(
        "flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 font-medium outline-none select-none",
        "data-[highlighted]:bg-hover data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        danger ? "text-danger" : "text-text",
      )}
    >
      <Icon size={20} aria-hidden className={clsx("shrink-0", !danger && "text-text-soft")} />
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="mx-1 my-1.5 h-0.5 bg-border" />;
}
