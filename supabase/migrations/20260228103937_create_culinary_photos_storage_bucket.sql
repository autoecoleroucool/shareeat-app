/*
  # Create Culinary Circle Photos Storage Bucket

  Creates a dedicated storage bucket for high-quality culinary circle food photos.
  Only Culinary Circle members (shares_count >= 10) can upload photos.
  All authenticated users can view photos for discovery purposes.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('culinary-photos', 'culinary-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view culinary photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'culinary-photos');

CREATE POLICY "Circle members can upload culinary photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'culinary-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.shares_count >= 10
    )
  );

CREATE POLICY "Authors can delete their culinary photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'culinary-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
