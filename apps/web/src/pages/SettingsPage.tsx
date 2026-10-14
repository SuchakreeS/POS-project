import { PHONE_MAX, SHOP_NAME_MAX, type ShopSettings } from "@pos/shared";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useBlocker } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/toast";
import { useSaveSettings, useShopSettings } from "@/features/settings/queries";
import {
  isSettingsDirty,
  SETTINGS_FIELDS,
  toFormValues,
  validateSettings,
  type SettingsField,
  type SettingsFormValues,
} from "@/features/settings/settings-form";
import { AddTerminalDialog } from "@/features/terminals/components/AddTerminalDialog";
import { TerminalsList } from "@/features/terminals/components/TerminalsList";
import { errorMessage } from "@/lib/errors";
import { apiFieldErrors, focusFirstInvalid, type FieldErrors } from "@/lib/forms";

/** Settings page (plan.md → Settings page, admin only): shop details, daily report and devices. */
export function SettingsPage() {
  const settings = useShopSettings();
  const [addingTerminal, setAddingTerminal] = useState(false);

  return (
    <>
      <PageHeader title="Settings" description="Shop details, daily report and devices" />
      {settings.isPending ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-32 w-full" />
          ))}
        </div>
      ) : settings.isError ? (
        <Alert tone="danger">
          <span className="flex flex-wrap items-center gap-3">
            Couldn't load the settings. {errorMessage(settings.error)}
            <Button
              size="sm"
              variant="outline"
              icon={<IconRefresh size={16} aria-hidden />}
              onClick={() => settings.refetch()}
            >
              Try again
            </Button>
          </span>
        </Alert>
      ) : (
        // A save puts the new values in the cache; the new key starts the form from them.
        <SettingsForm
          key={JSON.stringify(settings.data)}
          saved={settings.data}
          terminals={<TerminalsList onAdd={() => setAddingTerminal(true)} />}
        />
      )}
      {/* Outside the settings form: its own form must not submit the page's. */}
      {addingTerminal && <AddTerminalDialog onClose={() => setAddingTerminal(false)} />}
    </>
  );
}

function SettingsForm({ saved, terminals }: { saved: ShopSettings; terminals: ReactNode }) {
  const initial = toFormValues(saved);
  const [values, setValues] = useState<SettingsFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors<SettingsField>>({});
  const save = useSaveSettings();
  const dirty = isSettingsDirty(values, initial);

  // Leaving with unsaved changes: ask inside the app, and let the browser ask on close / reload.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends SettingsField>(key: K, value: SettingsFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const text = (key: "shopName" | "shopPhone" | "reportTime" | "defaultLowStockAt") => ({
    name: key,
    value: values[key],
    error: errors[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => set(key, event.target.value),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = validateSettings(values);
    if (!result.ok) {
      setErrors(result.errors);
      return focusFirstInvalid(form);
    }
    save.mutate(result.data, {
      onSuccess: () => toast.success("Settings saved"),
      onError: (error) => {
        const fieldErrors = apiFieldErrors(error, SETTINGS_FIELDS);
        if (fieldErrors) {
          setErrors(fieldErrors);
          focusFirstInvalid(form);
        } else toast.error(errorMessage(error));
      },
    });
  };

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 pb-24">
        <Section title="Shop" description="Shown on receipts and in the LINE report.">
          <TextField
            {...text("shopName")}
            label="Shop name"
            required
            autoComplete="off"
            maxLength={SHOP_NAME_MAX}
          />
          <TextField
            {...text("shopPhone")}
            label="Phone (optional)"
            inputMode="tel"
            autoComplete="off"
            maxLength={PHONE_MAX}
          />
        </Section>

        <Section
          title="Daily report"
          description="A summary of the day is saved at closing time and can be sent to LINE."
        >
          {/* A text field, not type="time": browsers show "10:00 PM" on 12-hour PCs. */}
          <TextField
            {...text("reportTime")}
            label="Report time"
            required
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            placeholder="22:00"
            className="max-w-56"
            hint="24-hour shop time, like 22:00"
          />
          <Switch
            label="Send to LINE"
            description="Post the report to the shop's LINE group at the report time."
            checked={values.sendReportToLine}
            onChange={(checked) => set("sendReportToLine", checked)}
          />
          <p className="text-sm text-text-muted">The LINE token is set on the server, not here.</p>
        </Section>

        <Section
          title="Terminals"
          description="Checkout PCs. Each one numbers its own bills. Pick which one this PC is."
        >
          {terminals}
        </Section>

        <Section title="Stock" description="Defaults for new items.">
          <TextField
            {...text("defaultLowStockAt")}
            label="Default low-stock alert"
            inputMode="numeric"
            unit="pcs"
            className="max-w-48"
            hint="Pre-filled when you add a new item"
          />
        </Section>

        {dirty && (
          <div
            role="region"
            aria-label="Unsaved changes"
            className="sticky bottom-4 flex items-center gap-4 self-center rounded-full border-2 border-border bg-surface-alt py-2 pr-2 pl-6 shadow-lg"
          >
            <span className="font-medium">You have unsaved changes</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                setValues(initial);
                setErrors({});
              }}
            >
              Discard
            </Button>
            <Button type="submit" size="sm" loading={save.isPending}>
              Save changes
            </Button>
          </div>
        )}
      </form>
      <ConfirmDialog
        open={blocker.state === "blocked"}
        icon={IconAlertTriangle}
        title="Leave without saving?"
        description="Your changes to the settings will be lost."
        cancelLabel="Keep editing"
        confirmLabel="Discard"
        destructive
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}

/** A settings card: title + one line on the left, fields on the right (plan.md → Settings page). */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[16rem_1fr] gap-8 rounded-2xl border-2 border-border p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      <div className="flex max-w-xl flex-col gap-4">{children}</div>
    </section>
  );
}
