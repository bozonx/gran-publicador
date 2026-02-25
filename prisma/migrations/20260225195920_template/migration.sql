-- CreateTable
CREATE TABLE "channel_template_variations" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "project_template_id" TEXT NOT NULL,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_template_variations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_template_variations_channel_id_idx" ON "channel_template_variations"("channel_id");

-- CreateIndex
CREATE INDEX "channel_template_variations_project_template_id_idx" ON "channel_template_variations"("project_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_template_variations_channel_id_project_template_id_key" ON "channel_template_variations"("channel_id", "project_template_id");

-- AddForeignKey
ALTER TABLE "channel_template_variations" ADD CONSTRAINT "channel_template_variations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_template_variations" ADD CONSTRAINT "channel_template_variations_project_template_id_fkey" FOREIGN KEY ("project_template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
