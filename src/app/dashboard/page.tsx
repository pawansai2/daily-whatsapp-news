import Link from 'next/link';

export default function Dashboard() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white shadow rounded">
                    <h2 className="text-xl font-bold mb-2">Digest Status</h2>
                    <p className="text-green-600 font-semibold">Active</p>
                </div>
                <div className="p-6 bg-white shadow rounded">
                    <h2 className="text-xl font-bold mb-2">Next Delivery</h2>
                    <p>Tomorrow at 08:00 AM</p>
                </div>
            </div>
            <div className="mt-8 flex gap-4">
                <Link href="/settings" className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Settings</Link>
                <Link href="/news-preview" className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Preview Digest</Link>
            </div>
        </div>
    );
}
