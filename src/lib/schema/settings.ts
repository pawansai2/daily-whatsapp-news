import { z } from 'zod';
import { parsePhoneNumberWithError } from 'libphonenumber-js';

export const SettingsUpdateSchema = z.object({
    phone: z.string().optional().refine((val) => {
        if (!val) return true;
        try {
            const phoneNumber = parsePhoneNumberWithError(val);
            return phoneNumber.isValid();
        } catch {
            return false;
        }
    }, { message: 'Invalid phone number' }),
    language: z.enum(['en', 'hi', 'te', 'ta', 'kn']).optional(),
    country: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    timezone: z.string().max(100).optional(), // 'Asia/Kolkata'
    delivery_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    story_limit: z.number().int().min(1).max(20).optional(),
    digest_enabled: z.boolean().optional(),
    interests: z.array(z.string().max(50)).max(20).optional(),
    custom_keywords: z.array(z.string().max(50)).max(20).optional(),
}).strict(); // Reject unknown properties
