import React, { useState, useEffect } from 'react';
import { Search, Recycle, Loader2, X, Sun, Moon, MessageSquare, Send, PlusCircle, Clock, ChevronRight, Leaf, Wind, Droplets } from 'lucide-react';

import axios from 'axios';

interface RecyclingItem {
  id: string;
  name: string;
}

interface RecyclingInstruction {
  id: string;
  items: RecyclingItem[];
  additionalNotes: string;
  instructions: string;
  timestamp: string;
}

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const BackgroundElements = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden">
    {/* Floating leaves */}
    <div className="absolute w-6 h-6 text-green-500/20 dark:text-green-500/10 animate-float-slow top-20 left-[15%]">
      <Leaf className="w-full h-full transform rotate-45" />
    </div>
    <div className="absolute w-8 h-8 text-green-500/20 dark:text-green-500/10 animate-float-slower top-40 right-[25%]">
      <Leaf className="w-full h-full transform -rotate-12" />
    </div>
    <div className="absolute w-5 h-5 text-green-500/20 dark:text-green-500/10 animate-float-slow top-60 left-[35%]">
      <Leaf className="w-full h-full transform rotate-90" />
    </div>

    {/* Floating recycle symbols */}
    <div className="absolute w-10 h-10 text-blue-500/20 dark:text-blue-500/10 animate-float-slower top-32 right-[15%]">
      <Recycle className="w-full h-full transform rotate-12" />
    </div>
    <div className="absolute w-7 h-7 text-blue-500/20 dark:text-blue-500/10 animate-float-slow top-80 left-[45%]">
      <Recycle className="w-full h-full transform -rotate-45" />
    </div>

    {/* Water drops */}
    <div className="absolute w-6 h-6 text-teal-500/20 dark:text-teal-500/10 animate-float-slower top-48 right-[35%]">
      <Droplets className="w-full h-full" />
    </div>
    <div className="absolute w-5 h-5 text-teal-500/20 dark:text-teal-500/10 animate-float-slow top-72 left-[25%]">
      <Droplets className="w-full h-full" />
    </div>

    {/* Organic shapes */}
    <div className="absolute top-0 left-0 w-64 h-64 bg-green-200/20 dark:bg-green-700/10 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2 animate-pulse-slow"></div>
    <div className="absolute top-1/3 right-0 w-96 h-96 bg-teal-200/20 dark:bg-teal-700/10 rounded-full blur-3xl transform translate-x-1/2 animate-pulse-slower"></div>
    <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-200/20 dark:bg-blue-700/10 rounded-full blur-3xl transform translate-y-1/2 animate-pulse-slow"></div>

    {/* Subtle gradient overlays */}
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 via-transparent to-teal-50/30 dark:from-emerald-900/30 dark:via-transparent dark:to-teal-900/30 mix-blend-overlay"></div>
  </div>
);

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [items, setItems] = useState<RecyclingItem[]>([{ id: '1', name: '' }]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<RecyclingInstruction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [showItemsInput, setShowItemsInput] = useState(true);
  const [hasInitialResponse, setHasInitialResponse] = useState(false);

  // Theme handling
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark');
  };

  // Fetch history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('recyclingHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('recyclingHistory', JSON.stringify(history));
    }
  }, [history]);

  const handleItemChange = (id: string, value: string) => {
    setItems(prevItems => {
      const updatedItems = prevItems.map(item =>
        item.id === id ? { ...item, name: value } : item
      );
      if (id === prevItems[prevItems.length - 1].id && value.trim() !== '') {
        return [...updatedItems, { id: Date.now().toString(), name: '' }];
      }
      return updatedItems;
    });
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(prevItems => prevItems.filter(item => item.id !== id));
    }
  };

  const buildPromptWithContext = (newPrompt: string): string => {
    const contextPrompt = messages.map(msg => 
      `${msg.type === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
    ).join('\n');
    
    return `${contextPrompt}\n\nHuman: ${newPrompt}`;
  };

  const loadHistoryChat = (entry: RecyclingInstruction) => {
    setMessages([
      {
        type: 'user',
        content: `Items: ${entry.items.map(i => i.name).join(', ')}`,
        timestamp: entry.timestamp
      },
      {
        type: 'assistant',
        content: entry.instructions,
        timestamp: entry.timestamp
      }
    ]);
    setShowItemsInput(false);
    setHasInitialResponse(true);
  };

  const fetchWithRetry = async (prompt: string, retryCount = 0): Promise<string> => {
    try {
      const response = await axios.post("https://waste-ai-krjb.onrender.com/api/gemini", {
        contents: [{ parts: [{ text: prompt }] }],
      });
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No instructions found.";
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429 && retryCount < MAX_RETRIES) {
        await sleep(RETRY_DELAY * Math.pow(2, retryCount));
        return fetchWithRetry(prompt, retryCount + 1);
      }
      throw err;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    let prompt = '';
    if (showItemsInput) {
      const validItems = items.filter(item => item.name.trim() !== '');
      if (validItems.length === 0) return;
      
      const itemsList = validItems.map(item => item.name).join(', ');
      prompt = `I have the following items: ${itemsList}. Instead of just recycling them, I want to explore creative ways to upcycle or repurpose them into something useful or beautiful. Please provide innovative ideas for transforming these items into new products, home decor, or practical everyday objects. Also, include any necessary recycling steps before repurposing. Additional considerations: ${additionalNotes}. Don't provide different answers for each item, provide the answer of using all together`;
    } else {
      if (!currentInput.trim()) return;
      prompt = currentInput;
    }

    const finalPrompt = !showItemsInput 
      ? buildPromptWithContext(prompt)
      : prompt;

    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      type: 'user',
      content: showItemsInput ? `Items: ${items.filter(item => item.name.trim() !== '').map(item => item.name).join(', ')}` : prompt,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setCurrentInput('');

    try {
      const response = await fetchWithRetry(finalPrompt);
      
      const assistantMessage: Message = {
        type: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (showItemsInput) {
        const validItems = items.filter(item => item.name.trim() !== '');
        const newInstruction: RecyclingInstruction = {
          id: Date.now().toString(),
          items: validItems,
          additionalNotes,
          instructions: response,
          timestamp: new Date().toISOString(),
        };
        setHistory(prev => [newInstruction, ...prev]);
        setShowItemsInput(false);
        setHasInitialResponse(true);
      }
    } catch (err) {
      setError('Failed to get a response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentInput('');
    setError(null);
    setItems([{ id: '1', name: '' }]);
    setAdditionalNotes('');
    setShowItemsInput(true);
    setHasInitialResponse(false);
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <style jsx global>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-15px) rotate(-5deg); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
        @keyframes pulse-slower {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.4; }
        }
        .animate-float-slow {
          animation: float-slow 4s ease-in-out infinite;
        }
        .animate-float-slower {
          animation: float-slower 6s ease-in-out infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        .animate-pulse-slower {
          animation: pulse-slower 6s ease-in-out infinite;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-teal-50 dark:from-emerald-900 dark:via-blue-900 dark:to-teal-900 text-gray-900 dark:text-white transition-colors duration-200">
        {/* Decorative elements */}
        <BackgroundElements />

        <div className="flex h-screen relative">
          {/* Sidebar */}
          <div className="w-80 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-r border-green-100 dark:border-green-900/50 flex flex-col">
            <div className="p-4 border-b border-green-100 dark:border-green-900/50">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                <Leaf className="w-5 h-5" />
                New Eco Chat
              </button>
              
              <button
                onClick={toggleTheme}
                className="mt-4 w-full flex items-center justify-center gap-2 p-3 bg-white/50 dark:bg-gray-700/50 hover:bg-white/70 dark:hover:bg-gray-600/70 rounded-lg transition-all duration-200 shadow hover:shadow-md backdrop-blur-sm"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Recycle className="w-5 h-5 text-emerald-500" />
                  Upcycling History
                </h2>
                <div className="space-y-3">
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => loadHistoryChat(entry)}
                      className="w-full p-4 bg-white/70 dark:bg-gray-700/70 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 group backdrop-blur-sm border border-green-100 dark:border-green-900/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Leaf className="w-5 h-5 text-emerald-500" />
                          <div className="text-left">
                            <p className="font-medium truncate">
                              {entry.items.map(i => i.name).join(', ')}
                            </p>
                            
                          </div>
                        </div>
                        <Wind className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col bg-transparent">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl shadow-md backdrop-blur-sm ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                        : 'bg-white/90 dark:bg-gray-800/90 border border-green-100 dark:border-green-900/50'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    <p className="text-xs mt-2 opacity-70">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/90 dark:bg-gray-800/90 p-4 rounded-2xl shadow-md backdrop-blur-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                </div>
              )}
              {error && (
                <div className="flex justify-center">
                  <p className="text-red-500 bg-red-100/90 dark:bg-red-900/20 px-6 py-3 rounded-xl shadow backdrop-blur-sm">
                    {error}
                  </p>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-green-100 dark:border-green-900/50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md p-6">
              {showItemsInput ? (
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={item.id} className="relative">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(item.id, e.target.value)}
                        placeholder={`Item ${index + 1} to upcycle`}
                        className="w-full p-4 rounded-xl bg-white/50 dark:bg-gray-900/50 border border-green-100 dark:border-green-900/50 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm hover:shadow-md backdrop-blur-sm"
                        disabled={isLoading}
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Additional notes for creative upcycling (optional)"
                    className="w-full p-4 rounded-xl bg-white/50 dark:bg-gray-900/50 border border-green-100 dark:border-green-900/50 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm hover:shadow-md backdrop-blur-sm"
                    rows={3}
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full p-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg font-medium"
                  >
                    {isLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Recycle className="w-6 h-6" />
                        Get Creative Ideas
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex gap-3">
                  <input
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    placeholder="Ask about more upcycling ideas..."
                    className="flex-1 p-4 rounded-xl bg-white/50 dark:bg-gray-900/50 border border-green-100 dark:border-green-900/50 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm hover:shadow-md backdrop-blur-sm"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
