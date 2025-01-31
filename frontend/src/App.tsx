import React, { useState } from 'react';
import { Search, Recycle, Loader2, ArrowRight } from 'lucide-react';
import axios from 'axios';

interface RecyclingInstruction {
  id: string;
  item: string;
  instructions: string;
  timestamp: string;
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY; // Replace with your actual API key
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const [item, setItem] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<RecyclingInstruction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchWithRetry = async (retryCount = 0): Promise<string> => {
    try {
      console.log("Making API request to Gemini backend...");
  
      const response = await axios.post("https://waste-ai-krjb.onrender.com/api/gemini", {
        contents: [
          {
            parts: [
              {
                text: `How should I recycle ${item}? Please provide specific steps and alternative ways to reuse it.`,
              },
            ],
          },
        ],
      });
      
  
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No instructions found.";
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error("API Error:", {
          status: err.response?.status,
          data: err.response?.data,
        });
  
        if (err.response?.status === 429 && retryCount < MAX_RETRIES) {
          console.log(`Retrying after ${RETRY_DELAY * Math.pow(2, retryCount)}ms...`);
          await sleep(RETRY_DELAY * Math.pow(2, retryCount));
          return fetchWithRetry(retryCount + 1);
        }
      }
      throw err;
    }
  };
  
  
  
  
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const instructions = await fetchWithRetry();

      const newInstruction: RecyclingInstruction = {
        id: Date.now().toString(),
        item: item.trim(),
        instructions,
        timestamp: new Date().toISOString(),
      };

      setHistory((prev) => [newInstruction, ...prev]);
      setItem('');
    } catch (err) {
      let errorMessage = 'Failed to get recycling instructions. Please try again.';
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (err.response?.status === 401) {
          errorMessage = 'Invalid API key. Please check your configuration.';
        }
        console.error('Error details:', {
          status: err.response?.status,
          message: err.response?.data?.error?.message,
        });
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Recycle className="h-16 w-16 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Recycling Assistant</h1>
          <p className="text-lg text-gray-600">
            Get AI-powered recycling instructions for any item
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-12">
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="Enter an item name (e.g., plastic bottle, cardboard box)"
              className="block w-full pl-10 pr-4 py-4 text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition duration-150 ease-in-out"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !item.trim()}
              className="absolute right-2 top-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {history.map((instruction) => (
            <div
              key={instruction.id}
              className="bg-white rounded-lg shadow-md p-6 transition duration-300 ease-in-out hover:shadow-lg"
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{instruction.item}</h3>
              <p className="text-gray-600 mb-4 whitespace-pre-line">{instruction.instructions}</p>
              <time className="text-sm text-gray-400">
                {new Date(instruction.timestamp).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
