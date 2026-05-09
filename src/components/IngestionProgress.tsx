'use client';

interface IngestionProgressProps {
  progress: number;
  status: string;
}

export default function IngestionProgress({ progress, status }: IngestionProgressProps) {
  return (
    <div className="w-full max-w-xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200 mt-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Analyzing Repository</h3>
      <p className="text-sm text-gray-600 mb-4">{status}</p>
      
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        ></div>
      </div>
      <div className="mt-2 text-right text-xs text-gray-500 font-medium tracking-wide">
        {Math.round(progress)}%
      </div>
    </div>
  );
}
