import Link from 'next/link';

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50 text-gray-900">
            <h1 className="text-4xl font-bold mb-4">Personal Daily Intelligence Assistant</h1>
            <p className="text-lg mb-8 text-center max-w-xl">
                Your private news digest delivered securely to WhatsApp.
            </p>
            <div className="flex gap-4">
                <Link href="/login" className="px-6 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700">
                    Login
                </Link>
            </div>
        </main>
    );
}
