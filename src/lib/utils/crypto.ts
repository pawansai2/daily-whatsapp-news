import crypto from 'crypto';

export function encryptPhone(phone: string): string {
    const key = process.env.PHONE_ENCRYPTION_KEY;
    if (!key || key.length !== 32) throw new Error('Invalid PHONE_ENCRYPTION_KEY');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(phone, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptPhone(encryptedPhone: string): string {
    const key = process.env.PHONE_ENCRYPTION_KEY;
    if (!key || key.length !== 32) throw new Error('Invalid PHONE_ENCRYPTION_KEY');
    const parts = encryptedPhone.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

export function hashPhone(phone: string): string {
    const key = process.env.PHONE_ENCRYPTION_KEY || 'fallback_salt';
    return crypto.createHmac('sha256', key).update(phone).digest('hex');
}
