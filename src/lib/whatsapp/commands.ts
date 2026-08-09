import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from '@/lib/whatsapp/client';

export async function processInboundCommand(senderNumber: string, messageId: string, text: string) {
    const supabaseAdmin = getSupabaseAdmin();
    void messageId;
    const command = text.trim().toUpperCase();

    // Find owner
    const { data: settings } = await supabaseAdmin
        .from('personal_settings')
        .select('*');

    // Simple resolution, in real app we decrypt and match phone numbers securely
    const ownerSettings = settings?.[0];
    if (!ownerSettings) return;

    if (command === 'HELP') {
        await sendWhatsAppMessage(senderNumber, 'Commands: LIST INTERESTS, ADD INTERESTS <values>, REMOVE INTERESTS <values>, UPDATE INTERESTS <values>, PAUSE, RESUME, STATUS');
        return;
    }

    if (command === 'PAUSE') {
        await supabaseAdmin.from('personal_settings').update({ digest_enabled: false }).eq('owner_id', ownerSettings.owner_id);
        await sendWhatsAppMessage(senderNumber, 'Digest paused.');
        return;
    }

    if (command === 'RESUME') {
        await supabaseAdmin.from('personal_settings').update({ digest_enabled: true }).eq('owner_id', ownerSettings.owner_id);
        await sendWhatsAppMessage(senderNumber, 'Digest resumed.');
        return;
    }

    if (command === 'STATUS') {
        await sendWhatsAppMessage(senderNumber, `Digest is ${ownerSettings.digest_enabled ? 'Active' : 'Paused'}.`);
        return;
    }

    // Example logic for UPDATE INTERESTS
    if (command.startsWith('UPDATE INTERESTS ')) {
        const values = command.replace('UPDATE INTERESTS ', '');

        // Confirmation logic
        const payload = { values: values.split(',').map(v => v.trim()) };
        const expiresAt = new Date(Date.now() + 15 * 60000).toISOString(); // 15 mins

        await supabaseAdmin.from('pending_confirmations').insert({
            owner_id: ownerSettings.owner_id,
            sender_hash: senderNumber, // Should be hashed securely
            operation_type: 'REPLACE_INTERESTS',
            payload,
            expires_at: expiresAt
        });

        await sendWhatsAppMessage(senderNumber, `Reply with 'CONFIRM REPLACE' to update interests to: ${values}`);
        return;
    }

    if (command === 'CONFIRM REPLACE') {
        // Confirmation validation logic here
        await sendWhatsAppMessage(senderNumber, 'Interests updated.');
        return;
    }

    // Default
    await sendWhatsAppMessage(senderNumber, 'Unknown command. Send HELP for options.');
}
