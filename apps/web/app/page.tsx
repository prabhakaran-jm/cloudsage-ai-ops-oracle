import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">CloudSage</h1>
        <p className="text-xl mb-8">AI Ops Oracle for Solo Engineers</p>
        <p className="text-gray-600 mb-8">
          Predict near-term failure risk and get actionable insights for your projects.
        </p>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="bg-gray-200 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-300"
          >
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}

