export async function sendWhatsAppMessage(recipient: string, messageBody: string) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.META_GRAPH_API_VERSION || 'v20.0';

    if (process.env.NEWS_PROVIDER_MODE === 'mock') {
        console.log(`[MOCK] Sent WhatsApp message to ${recipient}: ${messageBody}`);
        return { success: true, messageId: 'mock-msg-123' };
    }

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipient,
            type: 'text',
            text: { body: messageBody }
        })
    });

    if (!response.ok) {
        throw new Error(`WhatsApp API error: ${await response.text()}`);
    }

    return response.json();
}
