-- AlterTable
ALTER TABLE "discounts" ADD COLUMN     "collections" JSONB,
ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "gift_quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "gift_title" TEXT,
ADD COLUMN     "gift_variant_id" TEXT,
ADD COLUMN     "payment_methods" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "per_customer_limit" INTEGER,
ADD COLUMN     "show_in_checkout" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slabs" JSONB,
ADD COLUMN     "starts_at" TIMESTAMP(3),
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usage_limit" INTEGER;

-- AlterTable
ALTER TABLE "payment_settings" ADD COLUMN     "is_partial_discount_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partial_cod_type" TEXT NOT NULL DEFAULT 'flat',
ADD COLUMN     "partial_discount_type" TEXT NOT NULL DEFAULT 'percentage',
ADD COLUMN     "partial_discount_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "partial_free_shipping" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prepaid_free_shipping" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "discount_redemptions" (
    "id" TEXT NOT NULL,
    "discount_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rules" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "min_cart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_cart" DOUBLE PRECISION,
    "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pincodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payment_methods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discount_redemptions_discount_id_phone_idx" ON "discount_redemptions"("discount_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "discount_redemptions_discount_id_order_id_key" ON "discount_redemptions"("discount_id", "order_id");

-- CreateIndex
CREATE INDEX "shipping_rules_merchant_id_idx" ON "shipping_rules"("merchant_id");

-- CreateIndex
CREATE INDEX "discounts_merchant_id_is_active_idx" ON "discounts"("merchant_id", "is_active");

-- AddForeignKey
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rules" ADD CONSTRAINT "shipping_rules_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
