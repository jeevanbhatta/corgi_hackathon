'use client';

import { useState } from 'react';

interface URLInputProps {
  onSubmit: (url: string, owner: string, repo: string) => void;
  isLoading?: boolean;
}

export default function URLInput({ onSubmit, isLoading }: URLInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validates https://github.com/owner/repo format
    const githubRegex = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/?$/;
    const match = url.match(githubRegex);

    if (!match) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/facebook/react)');
      return;
    }

    onSubmit(url, match[1], match[2]);
  };

  return (
    <div className="w-full max-w-xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Explore a Repository</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="repo-url" className="block text-sm font-medium text-gray-700 mb-1">
            GitHub Repository URL
          </label>
          <input
            id="repo-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-black"
            disabled={isLoading}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          disabled={isLoading || !url.trim()}
        >
          {isLoading ? 'Initializing...' : 'Start Time Machine'}
        </button>
      </form>
    </div>
  );
}
