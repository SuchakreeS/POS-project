import type { Role } from "@pos/shared";
import {
  IconChartBar,
  IconNotebook,
  IconPackage,
  IconQrcode,
  IconReceipt,
  IconSettings,
  IconShoppingCart,
  IconUsers,
  type TablerIcon,
} from "@tabler/icons-react";

export interface NavItem {
  to: string;
  label: string;
  icon: TablerIcon;
}

export interface NavSection {
  /** Small heading above the section; none for the main section. */
  title?: string;
  /** Who sees this section. Leave out for everyone. */
  roles?: readonly Role[];
  items: readonly NavItem[];
}

/** Sidebar order from plan.md → App frame. The API still checks roles; hiding links is only for clarity. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    items: [
      { to: "/checkout", label: "Checkout", icon: IconShoppingCart },
      { to: "/stock", label: "Stock", icon: IconPackage },
      { to: "/promptpay", label: "PromptPay", icon: IconQrcode },
      { to: "/credit", label: "Credit", icon: IconNotebook },
      { to: "/orders", label: "Orders", icon: IconReceipt },
      { to: "/reports", label: "Reports", icon: IconChartBar },
    ],
  },
  {
    title: "Admin",
    roles: ["ADMIN"],
    items: [
      { to: "/users", label: "Users", icon: IconUsers },
      { to: "/settings", label: "Settings", icon: IconSettings },
    ],
  },
];

export const HOME_PATH = "/checkout";

export function navSectionsFor(role: Role): NavSection[] {
  return NAV_SECTIONS.filter((section) => !section.roles || section.roles.includes(role));
}
