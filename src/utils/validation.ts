import { z } from 'zod'

// User validation schemas
export const registerSchema = z.object({
  email: z.email('Email non valida'),
  username: z
    .string()
    .min(3, 'Username deve essere di almeno 3 caratteri')
    .max(20, 'Username deve essere massimo 20 caratteri')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username può contenere solo lettere, numeri e underscore'),
  password: z
    .string()
    .min(8, 'Password deve essere di almeno 8 caratteri')
    .regex(/[A-Z]/, 'Password deve contenere almeno una lettera maiuscola')
    .regex(/[0-9]/, 'Password deve contenere almeno un numero'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Le password non corrispondono',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email o username richiesto'),
  password: z.string().min(1, 'Password richiesta'),
})

export const updateProfileSchema = z.object({
  email: z.email('Email non valida').optional(),
  username: z
    .string()
    .min(3, 'Username deve essere di almeno 3 caratteri')
    .max(20, 'Username deve essere massimo 20 caratteri')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username può contenere solo lettere, numeri e underscore')
    .optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password attuale richiesta'),
  newPassword: z
    .string()
    .min(8, 'Password deve essere di almeno 8 caratteri')
    .regex(/[A-Z]/, 'Password deve contenere almeno una lettera maiuscola')
    .regex(/[0-9]/, 'Password deve contenere almeno un numero'),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'Le password non corrispondono',
  path: ['confirmNewPassword'],
})

// League validation schemas
export const createLeagueSchema = z.object({
  name: z.string().min(3, 'Nome lega deve essere di almeno 3 caratteri').max(50, 'Nome lega troppo lungo'),
  description: z.string().max(500, 'Descrizione troppo lunga').optional(),
  teamName: z.string().min(2, 'Nome squadra deve essere di almeno 2 caratteri').max(30, 'Nome squadra troppo lungo'),
  maxParticipants: z.number().int().min(2).max(20).default(8),
  initialBudget: z.number().int().min(100).max(10000).default(500),
  goalkeeperSlots: z.number().int().min(1).max(5).default(3),
  defenderSlots: z.number().int().min(3).max(12).default(8),
  midfielderSlots: z.number().int().min(3).max(12).default(8),
  forwardSlots: z.number().int().min(2).max(8).default(6),
})

export const updateLeagueSchema = createLeagueSchema.partial()

// Types inferred from schemas
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type CreateLeagueInput = z.infer<typeof createLeagueSchema>
export type UpdateLeagueInput = z.infer<typeof updateLeagueSchema>
