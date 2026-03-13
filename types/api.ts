import z from "zod";

export const idSchema = z.int()

export const questionSchema = z.object({
  id: idSchema,
  content: z.string(),
  fromLine: z.int().nonnegative(),
  toLine: z.int().nonnegative(),
})

export const questionNoIdSchema = questionSchema.omit({ id: true })

export type Session = { id: number ; code: number }
export type Question = z.infer<typeof questionSchema>
export type Answer = { id: number ; text: string }
