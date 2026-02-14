DELETE FROM "MembershipGym";
DELETE FROM "Membership" WHERE "userId" != (SELECT id FROM "User" WHERE email = 'admin@gymflow.com');
DELETE FROM "CheckIn" WHERE "userId" != (SELECT id FROM "User" WHERE email = 'admin@gymflow.com');
DELETE FROM "User" WHERE email != 'admin@gymflow.com';