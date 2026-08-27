-- Remove leftover demo teacher emails so only addresses typed in AMPM Flow are used.
UPDATE "Teacher"
SET "email" = ''
WHERE "email" ILIKE '%@riverside.edu'
   OR "email" ILIKE '%@example.com'
   OR "email" ILIKE '%@school.edu';
