import { ROLE_LABELS, type ManagedUser } from "@pos/shared";
import {
  IconDots,
  IconKey,
  IconPencil,
  IconPlus,
  IconPower,
  IconRefresh,
  IconUserOff,
} from "@tabler/icons-react";
import { clsx } from "clsx";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/toast";
import { useCurrentUser } from "@/features/auth/auth-store";
import { ResetPasswordDialog } from "@/features/users/components/ResetPasswordDialog";
import { UserFormDialog } from "@/features/users/components/UserFormDialog";
import { useSetUserActive, useUsers } from "@/features/users/queries";
import { formatDayTime } from "@/lib/datetime";
import { errorMessage } from "@/lib/errors";

type UsersDialog =
  { kind: "add" } | { kind: "edit" | "reset" | "turnOff"; user: ManagedUser } | null;

/** Users page (plan.md → Users page, admin only): who can log in, and what they can do. */
export function UsersPage() {
  const me = useCurrentUser();
  const users = useUsers();
  const setActive = useSetUserActive();
  const [dialog, setDialog] = useState<UsersDialog>(null);
  const close = () => {
    setDialog(null);
    setActive.reset();
  };

  const turnOn = (user: ManagedUser) =>
    setActive.mutate(
      { id: user.id, active: true },
      {
        onSuccess: () => toast.success(`${user.displayName} can log in again`),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  return (
    <>
      <PageHeader
        title="Users"
        description="Who can log in, and what they can do"
        actions={
          <Button
            icon={<IconPlus size={18} aria-hidden />}
            onClick={() => setDialog({ kind: "add" })}
          >
            Add user
          </Button>
        }
      />

      {users.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full" />
          ))}
        </div>
      ) : users.isError ? (
        <Alert tone="danger">
          <span className="flex flex-wrap items-center gap-3">
            Couldn't load the users. {errorMessage(users.error)}
            <Button
              size="sm"
              variant="outline"
              icon={<IconRefresh size={16} aria-hidden />}
              onClick={() => users.refetch()}
            >
              Try again
            </Button>
          </span>
        </Alert>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col />
            <col className="w-44" />
            <col className="w-32" />
            <col className="w-36" />
            <col className="w-56" />
            <col className="w-14" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-border text-left text-sm text-text-muted">
              <th scope="col" className="px-3 py-2 font-medium">
                Name
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Username
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Role
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Last login
              </th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === me.id}
                busy={setActive.isPending}
                onEdit={() => setDialog({ kind: "edit", user })}
                onReset={() => setDialog({ kind: "reset", user })}
                onTurnOff={() => setDialog({ kind: "turnOff", user })}
                onTurnOn={() => turnOn(user)}
              />
            ))}
          </tbody>
        </table>
      )}

      {dialog?.kind === "add" && <UserFormDialog onClose={close} />}
      {dialog?.kind === "edit" && (
        <UserFormDialog user={dialog.user} isSelf={dialog.user.id === me.id} onClose={close} />
      )}
      {dialog?.kind === "reset" && (
        <ResetPasswordDialog user={dialog.user} isSelf={dialog.user.id === me.id} onClose={close} />
      )}
      <ConfirmDialog
        open={dialog?.kind === "turnOff"}
        icon={IconUserOff}
        warning
        title={dialog?.kind === "turnOff" ? `Turn off ${dialog.user.displayName}?` : ""}
        description="They can't log in until an admin turns them back on, and they're logged out on every device within 15 minutes. Their sales and history stay."
        confirmLabel="Turn off"
        loading={setActive.isPending}
        error={setActive.isError ? errorMessage(setActive.error) : undefined}
        onCancel={close}
        onConfirm={() => {
          if (dialog?.kind !== "turnOff") return;
          const { user } = dialog;
          setActive.mutate(
            { id: user.id, active: false },
            {
              onSuccess: () => {
                toast.success(`${user.displayName} is turned off`);
                close();
              },
            },
          );
        }}
      />
    </>
  );
}

function UserRow({
  user,
  isSelf,
  busy,
  onEdit,
  onReset,
  onTurnOff,
  onTurnOn,
}: {
  user: ManagedUser;
  isSelf: boolean;
  busy: boolean;
  onEdit: () => void;
  onReset: () => void;
  onTurnOff: () => void;
  onTurnOn: () => void;
}) {
  return (
    <tr className={clsx("border-b-2 border-border", !user.isActive && "text-text-muted")}>
      <td className="px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={user.displayName} className={clsx(!user.isActive && "opacity-50")} />
          <span className="truncate font-medium">
            {user.displayName}
            {isSelf && <span className="font-normal text-text-muted"> (you)</span>}
          </span>
        </span>
      </td>
      <td className="truncate px-3">{user.username}</td>
      <td className="px-3">
        <Badge tone={user.role === "ADMIN" ? "dark" : "neutral"}>{ROLE_LABELS[user.role]}</Badge>
      </td>
      <td className="px-3">
        {user.isActive ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <Badge tone="neutral">Turned off</Badge>
        )}
      </td>
      <td className="px-3 text-sm text-text-soft">
        {user.lastLoginAt ? formatDayTime(user.lastLoginAt) : "Never"}
      </td>
      <td className="px-3 text-right">
        <Menu
          trigger={
            <button
              type="button"
              aria-label={`Actions for ${user.displayName}`}
              className="inline-flex size-9 items-center justify-center rounded-full text-text-soft hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none data-[state=open]:bg-hover"
            >
              <IconDots size={20} aria-hidden />
            </button>
          }
        >
          <MenuItem icon={IconPencil} onSelect={onEdit}>
            Edit
          </MenuItem>
          <MenuItem icon={IconKey} onSelect={onReset}>
            Reset password
          </MenuItem>
          <MenuSeparator />
          {user.isActive ? (
            <MenuItem icon={IconUserOff} danger disabled={isSelf} onSelect={onTurnOff}>
              {isSelf ? "Turn off (not yourself)" : "Turn off"}
            </MenuItem>
          ) : (
            <MenuItem icon={IconPower} disabled={busy} onSelect={onTurnOn}>
              Turn on
            </MenuItem>
          )}
        </Menu>
      </td>
    </tr>
  );
}
