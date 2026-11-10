-- Order status kept in step with Shopify
ALTER TABLE "orders" ADD COLUMN "shopify_financial_status" TEXT;
ALTER TABLE "orders" ADD COLUMN "shopify_fulfillment_status" TEXT;
ALTER TABLE "orders" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "cancel_reason" TEXT;
ALTER TABLE "orders" ADD COLUMN "refunded_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "shopify_updated_at" TIMESTAMP(3);
