export default function NewsPreview() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Digest Preview</h1>
            <div className="bg-gray-100 p-6 rounded-lg font-mono text-sm max-w-md">
                <p><strong>Your Interests</strong></p>
                <p>1. [TechCrunch] AI Startup raises $10M</p>
                <p>2. [SpaceX] New rocket launch scheduled</p>
                <br/>
                <p><strong>Local</strong></p>
                <p>1. [LocalNews] City marathon this weekend</p>
            </div>
            <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded">Refresh Preview</button>
        </div>
    );
}
