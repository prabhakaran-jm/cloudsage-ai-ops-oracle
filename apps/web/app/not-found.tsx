import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">404 - Page Not Found</h2>
        <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
        <Link
          href="/"
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 inline-block"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

