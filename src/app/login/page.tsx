export default function Login() {
    return (
        <div className="flex min-h-screen items-center justify-center p-24">
            <div className="p-8 bg-white shadow rounded-lg w-full max-w-md">
                <h1 className="text-2xl font-bold mb-4">Owner Login</h1>
                <p className="text-gray-600 mb-6">Access is restricted to the single owner.</p>
                <button className="w-full bg-blue-600 text-white py-2 rounded">
                    Sign in with Supabase
                </button>
            </div>
        </div>
    );
}
