-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "shopify_store_id" TEXT,
    "access_token" TEXT,
    "store_name" TEXT,
    "email" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "shopify_order_id" TEXT,
    "shopify_draft_order_id" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "customer_email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "product_title" TEXT,
    "variant_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_method" TEXT,
    "payment_id" TEXT,
    "prepaid_discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verification_status" TEXT,
    "order_status" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "verification_status" TEXT,
    "last_order_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "session_id" TEXT,
    "event_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_settings" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "razorpay_key_id" TEXT,
    "razorpay_key_secret" TEXT,
    "cashfree_app_id" TEXT,
    "cashfree_secret_key" TEXT,
    "payu_merchant_key" TEXT,
    "payu_merchant_salt" TEXT,
    "is_prepaid_discount_enabled" BOOLEAN NOT NULL DEFAULT false,
    "prepaidDiscountType" TEXT NOT NULL DEFAULT 'percentage',
    "prepaid_discount_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_partial_cod_enabled" BOOLEAN NOT NULL DEFAULT false,
    "partial_cod_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_cod_fee_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cod_fee_amount" DOUBLE PRECISION NOT NULL DEFAULT 69,
    "is_shipping_fee_enabled" BOOLEAN NOT NULL DEFAULT false,
    "shipping_fee_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "free_shipping_threshold" DOUBLE PRECISION NOT NULL DEFAULT 999,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_settings" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "primary_color" TEXT NOT NULL DEFAULT '#111827',
    "brand_logo_url" TEXT,
    "pre_login_banner_text" TEXT,
    "pre_login_banner_bg" TEXT DEFAULT '#000000',
    "pre_login_banner_color" TEXT DEFAULT '#ffffff',
    "post_login_banner_text" TEXT,
    "post_login_banner_bg" TEXT DEFAULT '#000000',
    "post_login_banner_color" TEXT DEFAULT '#ffffff',
    "fb_pixel_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'percentage',
    "value" DOUBLE PRECISION NOT NULL,
    "is_auto" BOOLEAN NOT NULL DEFAULT false,
    "can_combine" BOOLEAN NOT NULL DEFAULT false,
    "min_items" INTEGER NOT NULL DEFAULT 0,
    "min_cart_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_discount" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_funnels" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_variant_id" TEXT,
    "offer_variant_id" TEXT NOT NULL,
    "offerTitle" TEXT NOT NULL,
    "offerPrice" DOUBLE PRECISION NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_funnels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchants_shop_domain_key" ON "merchants"("shop_domain");

-- CreateIndex
CREATE UNIQUE INDEX "payment_settings_merchant_id_key" ON "payment_settings"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "widget_settings_merchant_id_key" ON "widget_settings"("merchant_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_verifications" ADD CONSTRAINT "otp_verifications_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_settings" ADD CONSTRAINT "widget_settings_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_funnels" ADD CONSTRAINT "upsell_funnels_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

