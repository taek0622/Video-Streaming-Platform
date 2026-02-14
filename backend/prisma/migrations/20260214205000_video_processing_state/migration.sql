DO $$
BEGIN
  ALTER TYPE "VideoStatus" ADD VALUE 'PROCESSING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "videos"
ADD COLUMN "playback_path" TEXT,
ADD COLUMN "error_message" TEXT;
