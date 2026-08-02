export default function Settings() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Personal Settings</h1>
            <form className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
                    <input type="text" className="w-full border rounded p-2" placeholder="+91 9999999999" disabled />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Interests (comma separated)</label>
                    <input type="text" className="w-full border rounded p-2" placeholder="AI, Startups, Space" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Delivery Time (IST)</label>
                    <input type="time" className="w-full border rounded p-2" defaultValue="08:00" />
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded">Save Settings</button>
            </form>
        </div>
    );
}
