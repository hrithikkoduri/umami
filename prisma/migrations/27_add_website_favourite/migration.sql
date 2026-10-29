-- CreateTable
CREATE TABLE "website_favourite" (
    "user_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_favourite_pkey" PRIMARY KEY ("user_id","website_id")
);

-- CreateIndex
CREATE INDEX "website_favourite_website_id_idx" ON "website_favourite"("website_id");

-- AddForeignKey
ALTER TABLE "website_favourite" ADD CONSTRAINT "website_favourite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_favourite" ADD CONSTRAINT "website_favourite_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("website_id") ON DELETE CASCADE ON UPDATE CASCADE;
