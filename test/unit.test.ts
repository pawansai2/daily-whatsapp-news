import { SettingsUpdateSchema } from '@/lib/schema/settings';
import { filterAndRankStories, NewsStory } from '@/lib/news/provider';
import { encryptPhone, decryptPhone } from '@/lib/utils/crypto';

// Setup Mock Environment
process.env.PHONE_ENCRYPTION_KEY = '12345678901234567890123456789012';

describe('Unit Tests - Validation & Utilities', () => {
    test('Settings Schema valid update', () => {
        const result = SettingsUpdateSchema.safeParse({
            language: 'en',
            story_limit: 15,
            digest_enabled: true
        });
        expect(result.success).toBe(true);
    });

    test('Settings Schema rejects unknown properties', () => {
        const result = SettingsUpdateSchema.safeParse({
            language: 'en',
            unknown_prop: 'hacker'
        });
        expect(result.success).toBe(false);
    });

    test('Phone encryption and decryption', () => {
        const phone = '+919876543210';
        const encrypted = encryptPhone(phone);
        const decrypted = decryptPhone(encrypted);
        expect(decrypted).toBe(phone);
    });

    test('Filter and Rank Stories - removes duplicates and sent hashes', () => {
        const stories: NewsStory[] = [
            { id: '1', title: 'A', description: '', source: '', originalUrl: 'http://a.com', category: 'Tech', region: '', publishedAt: new Date().toISOString(), score: 0 },
            { id: '2', title: 'A Duplicate', description: '', source: '', originalUrl: 'http://a.com', category: 'Tech', region: '', publishedAt: new Date().toISOString(), score: 0 },
            { id: '3', title: 'B', description: '', source: '', originalUrl: 'http://b.com', category: 'Tech', region: '', publishedAt: new Date().toISOString(), score: 0 },
        ];

        const filtered = filterAndRankStories(stories, ['3']); // Sent hash '3'

        expect(filtered.length).toBe(1);
        expect(filtered[0].id).toBe('1');
    });
});
