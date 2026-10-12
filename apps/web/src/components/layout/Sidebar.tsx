import { IconLogout } from "@tabler/icons-react";
import { clsx } from "clsx";
import { useState } from "react";
import { NavLink } from "react-router";
import { navSectionsFor, type NavItem } from "@/app/navigation";
import { useCurrentUser } from "@/features/auth/auth-store";
import { ROLE_LABELS } from "@/features/auth/roles";
import { useLogout } from "@/features/auth/use-logout";
import { Button } from "@/components/ui/Button";

/** Fixed nav on the right of every page (plan.md → Sidebar). */
export function Sidebar() {
  const user = useCurrentUser();
  const logout = useLogout();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <aside className="flex h-full w-[200px] shrink-0 flex-col border-l-2 border-border bg-page">
      <div className="px-5 pt-5 pb-4 text-2xl font-semibold text-primary">POS</div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
        {navSectionsFor(user.role).map((section, index) => (
          <div key={section.title ?? index} className={clsx(index > 0 && "mt-5")}>
            {section.title && (
              <p className="px-3 pb-1 text-sm font-medium text-text-muted">{section.title}</p>
            )}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t-2 border-border p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint font-semibold text-primary-dark"
          >
            {user.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{user.displayName}</p>
            <p className="text-sm text-text-muted">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          className="mt-3"
          icon={<IconLogout size={18} aria-hidden />}
          loading={loggingOut}
          onClick={handleLogout}
        >
          Log out
        </Button>
      </div>
    </aside>
  );
}

function SidebarLink({ item, badge }: { item: NavItem; badge?: number }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        clsx(
          "flex h-10 items-center gap-3 rounded-xl px-3 transition-colors",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          isActive
            ? "bg-primary-tint font-semibold text-primary-dark"
            : "font-medium text-text hover:bg-hover",
        )
      }
    >
      <Icon size={20} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge ? (
        <span className="rounded-full bg-warning-tint px-2 text-sm font-semibold text-warning-text">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}
