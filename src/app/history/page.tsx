export default function History() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Delivery History</h1>
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b">
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Attempt</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b">
                        <td className="p-2">2026-08-01</td>
                        <td className="p-2 text-green-600">Success</td>
                        <td className="p-2">1</td>
                    </tr>
                    <tr className="border-b">
                        <td className="p-2">2026-07-31</td>
                        <td className="p-2 text-green-600">Success</td>
                        <td className="p-2">1</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
