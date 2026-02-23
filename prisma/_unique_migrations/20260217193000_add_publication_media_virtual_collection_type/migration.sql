-- Extend ContentCollectionType enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContentCollectionType') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ContentCollectionType'
        AND e.enumlabel = 'PUBLICATION_MEDIA_VIRTUAL'
    ) THEN
      ALTER TYPE "ContentCollectionType" ADD VALUE 'PUBLICATION_MEDIA_VIRTUAL';
    END IF;
  END IF;
END $$;
