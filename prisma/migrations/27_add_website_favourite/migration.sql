-- CreateTable
CREATE TABLE "website_favourite" (
    "website_favourite_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_favourite_pkey" PRIMARY KEY ("website_favourite_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_favourite_user_id_website_id_key" ON "website_favourite"("user_id", "website_id");

-- CreateIndex
CREATE INDEX "website_favourite_website_id_idx" ON "website_favourite"("website_id");
