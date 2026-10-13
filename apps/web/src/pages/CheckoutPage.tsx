import type { Product } from "@pos/shared";
import { IconAlertTriangle, IconPackageOff, IconSearch, IconTrash } from "@tabler/icons-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { NavDrawer } from "@/components/layout/NavDrawer";
import { Alert } from "@/components/ui/Alert";
import { Chip } from "@/components/ui/Chip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Kbd";
import { Skeleton } from "@/components/ui/Skeleton";
import { AddItemDialog } from "@/features/catalog/components/AddItemDialog";
import { ItemCard } from "@/features/catalog/components/ItemCard";
import {
  ProductSearchBox,
  type ProductSearchBoxHandle,
} from "@/features/catalog/components/ProductSearchBox";
import { useProducts } from "@/features/catalog/queries";
import { matchesSearch } from "@/features/catalog/stock-filter";
import { buildCart, needsStockConfirm } from "@/features/checkout/cart";
import { useCartStore } from "@/features/checkout/cart-store";
import { CartPanel } from "@/features/checkout/components/CartPanel";
import { PaymentDialog } from "@/features/checkout/components/PaymentDialog";
import { useTerminal } from "@/features/checkout/terminal";
import { useShopSettings } from "@/features/settings/queries";

type Overlay =
  | "payment"
  | "discount"
  | "clear"
  | { addBarcode: string }
  /** Misclick guard: the bill would hold more than the stock count. */
  | { stockCheck: { product: Product; qty: number } }
  | null;

/**
 * Checkout (plan.md → Checkout layout, Scanner and keyboard): product grid with the scan box on
 * the left, the current bill on the right. F2 search · F4 discount · F9 pay · Del remove line.
 */
export function CheckoutPage() {
  const products = useProducts();
  const { terminal, isError: terminalError, isPending: terminalPending } = useTerminal();
  useShopSettings(); // Add new item (unknown barcode) pre-fills the low-stock alert from it

  const { lines, discount, selectedId, overStockOk, add, setQty, remove, clear, allowOverStock } =
    useCartStore();
  const cart = useMemo(
    () => buildCart(lines, products.data ?? [], discount),
    [lines, products.data, discount],
  );

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const search = useRef<ProductSearchBoxHandle>(null);
  const addBarcode =
    typeof overlay === "object" && overlay && "addBarcode" in overlay
      ? overlay.addBarcode
      : undefined;
  const stockCheck =
    typeof overlay === "object" && overlay && "stockCheck" in overlay
      ? overlay.stockCheck
      : undefined;

  const backToScanning = () => {
    setOverlay(null);
    // After the dialog's own focus handling has finished.
    requestAnimationFrame(() => search.current?.focus());
  };

  const qtyInCart = (productId: string) =>
    lines.find((line) => line.productId === productId)?.qty ?? 0;

  /** Every way of adding goes through here: going over the stock count asks first (once per item). */
  const requestQty = (product: Product, qty: number) => {
    if (qty > qtyInCart(product.id) && needsStockConfirm(product, qty, overStockOk)) {
      setOverlay({ stockCheck: { product, qty } });
      return;
    }
    applyQty(product.id, qty);
  };

  const applyQty = (productId: string, qty: number) => {
    if (qtyInCart(productId) === 0) add(productId, qty);
    else setQty(productId, qty);
  };

  const pick = (product: Product) => requestQty(product, qtyInCart(product.id) + 1);

  // ---------- Keyboard ----------
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (overlay !== null) return; // dialogs handle their own keys
    const typing = isTextField(event.target);

    if (event.key === "F2") {
      event.preventDefault();
      search.current?.focus();
    } else if (event.key === "F4" && cart.rows.length > 0) {
      event.preventDefault();
      setOverlay("discount");
    } else if (event.key === "F9") {
      event.preventDefault();
      if (cart.sellable && terminal) setOverlay("payment");
    } else if (event.key === "Delete" && !typing && selectedId) {
      event.preventDefault();
      remove(selectedId);
    } else if (!typing && isPrintable(event)) {
      // A scan or typing while focus is elsewhere still lands in the scan box.
      search.current?.focus();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // ---------- Grid ----------
  const active = (products.data ?? []).filter((product) => product.isActive);
  const categories = uniqueCategories(active);
  const shown = active
    .filter(
      (product) =>
        matchesSearch(product, query) && (!category || product.category?.id === category),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "th"));

  const blocker = terminalError ? (
    <Alert tone="danger">Couldn't load the checkout devices. Check the connection.</Alert>
  ) : !terminalPending && !terminal ? (
    <Alert tone="danger">This shop has no checkout device set up. Ask the admin.</Alert>
  ) : undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      <main className="flex min-w-0 flex-1 flex-col px-6 pt-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <ProductSearchBox
              handleRef={search}
              products={products.data ?? []}
              onPick={pick}
              onAddNew={(barcode) => setOverlay({ addBarcode: barcode })}
              showSuggestions={false}
              onQueryChange={setQuery}
              label="Scan or search items"
              placeholder="Scan a barcode, or type a name or SKU"
              autoFocus
            />
          </div>
          <Kbd className="mt-2">F2</Kbd>
          <NavDrawer />
        </div>

        {categories.length > 1 && (
          <div role="group" aria-label="Category" className="mt-4 flex flex-wrap gap-2">
            <Chip selected={category === ""} onClick={() => setCategory("")}>
              All
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} selected={category === c.id} onClick={() => setCategory(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-6">
          {products.isPending ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
          ) : products.isError ? (
            <Alert tone="danger">Couldn't load the items. Check the connection and reload.</Alert>
          ) : shown.length === 0 ? (
            active.length === 0 ? (
              <EmptyState
                icon={IconPackageOff}
                title="No items yet"
                description={
                  <>
                    Add items on the{" "}
                    <Link to="/stock" className="font-medium text-primary hover:underline">
                      Stock page
                    </Link>{" "}
                    first.
                  </>
                }
              />
            ) : (
              <EmptyState
                icon={IconSearch}
                title={`No items match “${query.trim()}”`}
                description="Check the spelling or scan it."
              />
            )
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
              {shown.map((product) => (
                <ItemCard
                  key={product.id}
                  product={product}
                  selected={product.id === selectedId}
                  onClick={() => {
                    pick(product);
                    search.current?.focus();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <CartPanel
        cart={cart}
        onQtyChange={(productId, qty) => {
          const product = cart.rows.find((row) => row.productId === productId)?.product;
          if (product) requestQty(product, qty);
          else setQty(productId, qty); // item gone from the list: only lowering/removing makes sense
        }}
        discountOpen={overlay === "discount"}
        onDiscountOpenChange={(open) => (open ? setOverlay("discount") : backToScanning())}
        onCheckout={() => setOverlay("payment")}
        onClear={() => setOverlay("clear")}
        blocker={blocker}
      />

      {terminal && (
        <PaymentDialog
          open={overlay === "payment"}
          cart={cart}
          terminalId={terminal.id}
          onCancel={backToScanning}
          onNewSale={(scanned) => {
            backToScanning();
            if (scanned) requestAnimationFrame(() => search.current?.scan(scanned));
          }}
        />
      )}

      <ConfirmDialog
        open={overlay === "clear"}
        icon={IconTrash}
        destructive
        title="Clear this bill?"
        description="All items and the discount are removed. Nothing is saved."
        confirmLabel="Clear bill"
        onCancel={backToScanning}
        onConfirm={() => {
          clear();
          backToScanning();
        }}
      />

      <AddItemDialog
        open={addBarcode !== undefined}
        initialBarcode={addBarcode}
        onClose={backToScanning}
        onSaved={(product) => {
          // Just created from the item in hand: no stock question.
          allowOverStock(product.id);
          add(product.id);
        }}
      />

      <ConfirmDialog
        open={stockCheck !== undefined}
        icon={IconAlertTriangle}
        warning
        title={
          stockCheck && stockCheck.product.stockQty <= 0
            ? `${stockCheck.product.name} is out of stock`
            : `Only ${stockCheck?.product.stockQty.toLocaleString("en-US")} ${stockCheck?.product.name} in stock`
        }
        description={
          <>
            The bill would have {stockCheck?.qty.toLocaleString("en-US")}. If the item is really
            here (a delivery not entered yet), add it anyway and restock it later.
          </>
        }
        cancelLabel="Don't add"
        confirmLabel="Add anyway"
        onCancel={backToScanning}
        onConfirm={() => {
          if (stockCheck) {
            allowOverStock(stockCheck.product.id);
            applyQty(stockCheck.product.id, stockCheck.qty);
          }
          backToScanning();
        }}
      />
    </div>
  );
}

function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function isPrintable(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

function uniqueCategories(products: readonly Product[]) {
  const byId = new Map<string, { id: string; name: string }>();
  for (const product of products)
    if (product.category) byId.set(product.category.id, product.category);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
}
