/*
  # Nettoyage mensuel de l'historique des repas

  ## Objectif
  Supprimer automatiquement chaque mois les repas anciens de plus d'un mois
  pour garder la base de données légère, tout en préservant :
  - Le compteur `shares_count` sur le profil (nombre total de partages)
  - Le compteur `meals_given` sur le profil (nombre de personnes régalées)

  ## Logique
  Un repas est éligible à la suppression si :
  - Il a plus d'un mois (created_at < now() - 1 mois)
  - ET l'une des conditions suivantes est vraie :
    a) Le repas est expiré (expires_at < now())
    b) Tous les slots sont pris (slots_taken >= slots_total)
    c) Il est marqué comme claimed = true

  ## Sécurité des compteurs
  Les compteurs `shares_count` et `meals_given` sur `profiles` sont mis à jour
  via des triggers existants au moment de la création/réservation, pas à la suppression.
  Ils ne sont donc PAS affectés par ce nettoyage.

  ## Job cron
  - Fréquence : le 1er de chaque mois à 3h du matin
  - Extension utilisée : pg_cron
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION cleanup_old_meal_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_date timestamptz := now() - interval '1 month';
BEGIN
  DELETE FROM meals
  WHERE created_at < cutoff_date
    AND (
      (expires_at IS NOT NULL AND expires_at < now())
      OR slots_taken >= slots_total
      OR claimed = true
    );
END;
$$;

SELECT cron.schedule(
  'monthly-meal-history-cleanup',
  '0 3 1 * *',
  'SELECT cleanup_old_meal_history()'
);
