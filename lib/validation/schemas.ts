import { z } from "zod";

const personRoleEnum = z.enum(["priest", "bishop", "religious", "layperson"]);
const prayerTypeEnum = z.enum([
  "our_father",
  "hail_mary",
  "decade_rosary",
  "full_rosary",
  "mass",
  "divine_mercy_chaplet",
  "other",
]);

/** Request body for POST /api/pray */
export const PrayRequestSchema = z.object({
  personId: z.string().uuid("personId must be a valid UUID"),
  prayerType: prayerTypeEnum,
});

/** Request body for POST /api/admin/deceased */
export const CreateDeceasedRequestSchema = z.object({
  firstName: z.string().min(1).max(50).regex(/^[A-Za-z]+$/, "Letters only"),
  lastInitial: z.string().length(1).regex(/^[A-Z]$/, "Single letter A–Z"),
  yearOfDeath: z
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear()),
  role: personRoleEnum,
  cemeteryId: z.string().uuid("cemeteryId must be a valid UUID"),
});

/** Request body for POST /api/admin/cemeteries */
export const CreateCemeteryRequestSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(200).optional(),
  city: z.string().min(1).max(50),
  state: z.string().length(2).regex(/^[A-Z]{2}$/, "2-letter state code"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  archdiocese: z.string().min(1).max(50),
});

/** Query params for GET /api/cemeteries */
export const CemeteriesQuerySchema = z.object({
  archdiocese: z.string().min(1).max(50).optional().default("Atlanta"),
});

export type PrayRequestInput = z.infer<typeof PrayRequestSchema>;
export type CreateDeceasedRequestInput = z.infer<typeof CreateDeceasedRequestSchema>;
export type CreateCemeteryRequestInput = z.infer<typeof CreateCemeteryRequestSchema>;
export type CemeteriesQueryInput = z.infer<typeof CemeteriesQuerySchema>;
