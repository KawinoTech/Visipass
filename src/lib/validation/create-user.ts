import { z } from "zod";

/** Matches `UserRole` in `prisma/schema.prisma`. */
export const USER_ROLES = ["ADMIN", "RECEPTIONIST", "SECURITY", "EMPLOYEE"] as const;

/** Matches `UserLocation` in `prisma/schema.prisma`. */
export const USER_LOCATIONS = [
  "HEAD_OFFICE",
  "NAKURU_BRANCH",
  "ELDORET_BRANCH",
  "MERU_BRANCH",
  "NAIROBI_CBD_BRANCH",
  "THIKA_BRANCH",
] as const;

/** Matches `UserFloor` in `prisma/schema.prisma`. */
export const USER_FLOORS = ["GROUND_FLOOR", "FIRST_FLOOR", "SECOND_FLOOR"] as const;

export const MUA_EMAIL_DOMAIN = "mua.co.ke";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[0-9]/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol.");

/**
 * Request body for `POST /api/users` (plain password; hash before persisting).
 * Floor rules: only meaningful when `location === HEAD_OFFICE` (optional enum or null).
 * For all other locations, `floor` must be `null` or omitted.
 */
export const createUserRequestSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters."),
    userLoginId: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9._-]{2,64}$/, "User ID: use 2–64 letters, numbers, . _ or - only."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email address.")
      .refine((val) => val.endsWith(`@${MUA_EMAIL_DOMAIN}`), {
        message: `Email must use the @${MUA_EMAIL_DOMAIN} domain.`,
      }),
    location: z.enum(USER_LOCATIONS),
    floor: z.union([z.enum(USER_FLOORS), z.null()]).optional(),
    role: z.enum(USER_ROLES),
    password: passwordSchema,
  })
  .superRefine((data, ctx) => {
    const floor = data.floor === undefined ? null : data.floor;

    if (data.location === "HEAD_OFFICE") {
      return;
    }

    if (floor != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["floor"],
        message: "Floor may only be set when location is Head Office.",
      });
    }
  });

export type CreateUserRequestInput = z.input<typeof createUserRequestSchema>;
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
