/*
  # Add 'closed' status to culinary challenges

  ## Summary
  Allows challenge creators to manually close their challenge once at least 3 members
  have accepted. A closed challenge is no longer visible to non-members and no longer
  accepts new applicants or invitations.

  ## Changes
  - Modifies the `status` CHECK constraint on `culinary_challenges` to allow 'closed'
  - Updates RLS SELECT policy so closed challenges are only visible to their accepted members
    (and the creator)

  ## Statuses after this migration
  - `open`      – accepting new members
  - `active`    – min members reached, still visible to members
  - `closed`    – creator manually closed; hidden from non-members
  - `completed` – challenge finished
*/

-- 1. Drop the old CHECK constraint and add the new one that includes 'closed'
ALTER TABLE culinary_challenges
  DROP CONSTRAINT IF EXISTS culinary_challenges_status_check;

ALTER TABLE culinary_challenges
  ADD CONSTRAINT culinary_challenges_status_check
    CHECK (status IN ('open', 'active', 'closed', 'completed'));
