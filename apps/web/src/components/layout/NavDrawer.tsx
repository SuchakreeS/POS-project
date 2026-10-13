import { IconMenu2, IconX } from "@tabler/icons-react";
import { Dialog as RadixDialog } from "radix-ui";
import { useState } from "react";
import { NavContent } from "./NavContent";

/**
 * Checkout's nav: a hamburger that slides the menu in from the right, over the cart, with a dim
 * overlay (plan.md → Checkout layout). ✕, Esc or a click on the overlay closes it.
 */
export function NavDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger
        aria-label="Open menu"
        className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-border-strong text-text-soft hover:bg-hover focus-visible:ring-4 focus-visible:ring-primary-tint focus-visible:outline-none"
      >
        <IconMenu2 size={22} aria-hidden />
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed top-0 right-0 z-50 flex h-full w-[240px] flex-col border-l-2 border-border bg-page shadow-xl focus:outline-none"
        >
          <RadixDialog.Title className="sr-only">Menu</RadixDialog.Title>
          <RadixDialog.Close
            aria-label="Close menu"
            className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <IconX size={22} aria-hidden />
          </RadixDialog.Close>
          <NavContent onNavigate={() => setOpen(false)} />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
