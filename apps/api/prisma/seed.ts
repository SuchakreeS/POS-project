/**
 * Seed data for a fresh database (safe to run more than once).
 * Creates: shop settings, terminal T1, the first admin user, a few categories and sample products.
 *
 *   pnpm db:seed
 *
 * Needs SEED_ADMIN_PASSWORD in apps/api/.env (at least 8 characters).
 * Sample products are only added when the product table is empty.
 */
import "dotenv/config";
import { toSatang } from "@pos/shared";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL (or DATABASE_URL) in apps/api/.env first.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  // 1) Shop settings (single row, id = 1)
  await prisma.shopSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, shopName: "My Shop", reportTime: "22:00", defaultLowStockAt: 5 },
  });

  // 2) Terminal T1
  await prisma.terminal.upsert({
    where: { code: "T1" },
    update: {},
    create: { code: "T1", name: "Front counter" },
  });

  // 3) First admin user
  const username = (process.env.SEED_ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (password.length < 8) {
    throw new Error("Set SEED_ADMIN_PASSWORD (8+ characters) in apps/api/.env before seeding.");
  }
  const admin = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      displayName: "Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  // 4) Sample categories + products (only into an empty catalog)
  if ((await prisma.product.count()) > 0) {
    console.log("Products already exist, skipping sample products.");
  } else {
    const categories = ["Drinks", "Dry food", "Cooking", "Snacks"];
    const cat: Record<string, string> = {};
    for (const name of categories) {
      const c = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
      cat[name] = c.id;
    }

    const products = [
      {
        name: "Drinking water 600 ml",
        sku: "DR-0001",
        barcode: "8850000000011",
        category: "Drinks",
        price: 7,
        cost: 4.5,
        stock: 48,
      },
      {
        name: "Soy milk 300 ml",
        sku: "DR-0042",
        barcode: "8850000000028",
        category: "Drinks",
        price: 12,
        cost: 8.5,
        stock: 0,
      },
      {
        name: "Instant noodles",
        sku: "GR-0015",
        barcode: "8850000000035",
        category: "Dry food",
        price: 7,
        cost: 5,
        stock: 120,
      },
      {
        name: "Rice 5 kg",
        sku: "GR-0003",
        barcode: "8850000000042",
        category: "Dry food",
        price: 185,
        cost: 160,
        stock: 16,
      },
      {
        name: "Cooking oil 1 L",
        sku: "GR-0107",
        barcode: "8850000000059",
        category: "Cooking",
        price: 55,
        cost: 46,
        stock: 3,
      },
      {
        name: "Canned fish",
        sku: "GR-0021",
        barcode: "8850000000066",
        category: "Cooking",
        price: 22,
        cost: 17,
        stock: 30,
      },
      {
        name: "Potato chips",
        sku: "SN-0004",
        barcode: "8850000000073",
        category: "Snacks",
        price: 20,
        cost: 14,
        stock: 24,
      },
    ];

    for (const p of products) {
      await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            categoryId: cat[p.category],
            price: toSatang(p.price),
            cost: toSatang(p.cost),
            stockQty: p.stock,
            lowStockAt: 5,
          },
        });
        if (p.stock > 0) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: "INITIAL",
              qty: p.stock,
              reason: "Seed data",
              userId: admin.id,
            },
          });
        }
      });
    }
    console.log(`Added ${products.length} sample products.`);
  }

  console.log(`✅ Seed done. Admin login: ${username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
