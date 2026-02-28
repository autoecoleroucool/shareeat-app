/*
  # Create storage bucket for meal images

  - Creates a public 'meal-images' bucket
  - Sets storage policies so authenticated users can upload
  - All users can view images
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-images', 'meal-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload meal images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'meal-images');

CREATE POLICY "Anyone can view meal images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'meal-images');

CREATE POLICY "Users can update their own meal images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'meal-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own meal images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'meal-images' AND auth.uid()::text = (storage.foldername(name))[1]);
