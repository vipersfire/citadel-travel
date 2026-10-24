import { z } from 'zod';
export const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(2000).optional(),
    status: z.string().max(50).optional(),
    stage: z.string().max(50).optional(),
    search: z.string().max(150).optional(),
    batch_id: z.uuid().optional(),
    package_id: z.uuid().optional(),
    needs_review: z.enum(['true', 'false']).optional(),
    due_within: z.enum(['24h']).optional(),
    departures_within: z.enum(['14d']).optional(),
    overdue:z.enum(['true']).optional(),
    missing_only: z.enum(['true']).optional(),
  })
  .strict();
export const localizedInputSchema = z
  .object({ id: z.string().max(8000), en: z.string().max(8000).optional() })
  .strict();
export const eventNoticeSchema = z
  .object({
    template: z.enum(['confirmed', 'changed', 'cancelled']),
    message: localizedInputSchema.optional(),
  })
  .strict();
export const uploadInitSchema = z
  .object({
    kind: z.enum(['document', 'image', 'video']),
    filename: z
      .string()
      .min(1)
      .max(250)
      .regex(/^[^\x00-\x1f\x7f]+$/),
    mime: z.enum([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
    ]),
    bytes: z
      .number()
      .int()
      .positive()
      .max(80 * 1024 * 1024),
    batch_id: z.uuid().optional(),
    booking_id: z.uuid().optional(),
    traveler_id: z.uuid().optional(),
    type: z
      .enum([
        'flight_ticket',
        'hotel_voucher',
        'event_ticket',
        'transfer_voucher',
        'insurance',
        'itinerary',
        'payment_proof',
        'other',
      ])
      .optional(),
    title: localizedInputSchema.optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.kind === 'image' && !v.mime.startsWith('image/'))
      c.addIssue({ code: 'custom', message: 'Choose an image file.' });
    if (v.kind === 'video' && !v.mime.startsWith('video/'))
      c.addIssue({ code: 'custom', message: 'Choose a video file.' });
    if (v.kind === 'document' && !['application/pdf', 'image/jpeg', 'image/png'].includes(v.mime))
      c.addIssue({ code: 'custom', message: 'Choose PDF, JPG or PNG.' });
    const max = v.kind === 'document' ? 20 : v.kind === 'image' ? 25 : 80;
    if (v.bytes > max * 1024 * 1024) c.addIssue({ code: 'custom', message: `Maximum ${max} MB.` });
    if (
      v.kind === 'document' &&
      (!v.type || (!v.booking_id && !v.batch_id && v.type !== 'payment_proof'))
    )
      c.addIssue({ code: 'custom', message: 'Choose a document type and booking or batch.' });
  });
export const cursorSchema = z
  .object({
    id: z.string().max(200),
    requested_at: z.string().optional(),
    resource: z.string().max(50),
    filter: z.string().max(100),
  })
  .strict();
export const profileSchema = z
  .object({
    full_name: z.string().trim().min(2).max(150),
    whatsapp_e164: z
      .string()
      .regex(/^\+[1-9][0-9]{7,14}$/)
      .nullable(),
    whatsapp_opt_in: z.boolean(),
    locale: z.enum(['id', 'en']),
  })
  .strict();
export const changePasswordSchema = z
  .object({
    current_password: z.string().max(128).optional(),
    password: z.string().min(10).max(128),
  })
  .strict();
export const parsedPaymentEventSchema = z
  .object({
    session_id: z.string().min(1).optional(),
    reference_id: z.string().min(1).optional(),
    type: z.enum(['completed', 'expired', 'canceled', 'failed', 'unknown']),
    amount: z.number().int().nonnegative().optional(),
    currency: z.string().optional(),
    payment_id: z.string().optional(),
    paid_at: z.string().optional(),
  })
  .strict();
