-- Google Analytics, Google Ads and the Meta Conversions API
ALTER TABLE "widget_settings" ADD COLUMN "meta_capi_token" TEXT;
ALTER TABLE "widget_settings" ADD COLUMN "ga4_measurement_id" TEXT;
ALTER TABLE "widget_settings" ADD COLUMN "google_ads_id" TEXT;
ALTER TABLE "widget_settings" ADD COLUMN "google_ads_label" TEXT;
