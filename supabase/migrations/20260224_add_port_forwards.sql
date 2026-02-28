ALTER TABLE "public"."hosts" ADD COLUMN "port_forwards" jsonb DEFAULT '[]'::jsonb;
