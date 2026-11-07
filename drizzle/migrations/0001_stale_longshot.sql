ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "is_guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "subcategory" text;--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_product_url_uq" ON "product_images" USING btree ("product_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_phone_uq" ON "profiles" USING btree ("phone");