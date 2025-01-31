import React, { useState, useEffect } from 'react';
import { Search, Recycle, Loader2, X, Sun, Moon, MessageSquare, Send, PlusCircle } from 'lucide-react';
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
    // Get all previous messages for context since we want to maintain the full conversation
    const contextPrompt = messages.map(msg => 
      `${msg.type === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
    ).join('\n');
    
    return `${contextPrompt}\n\nHuman: ${newPrompt}`;
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
      prompt = `I need recycling instructions for the following items: ${itemsList}. Additional considerations: ${additionalNotes}`;
    } else {
      if (!currentInput.trim()) return;
      prompt = currentInput;
    }

    // Build prompt with context if it's a follow-up question
    const finalPrompt = !showItemsInput 
      ? buildPromptWithContext(prompt)
      : prompt;

    setIsLoading(true);
    setError(null);

    // Add user message
    const userMessage: Message = {
      type: 'user',
      content: prompt,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setCurrentInput('');

    try {
      const response = await fetchWithRetry(finalPrompt);
      
      // Add assistant message
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
        
        // Automatically switch to chat mode after getting initial response
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
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <div className="p-4">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <PlusCircle className="w-5 h-5" />
                New Chat
              </button>
              
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="mt-4 w-full flex items-center justify-center gap-2 p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>

            <div className="px-4 mt-4">
              <h2 className="text-xl font-semibold mb-4">Chat History</h2>
              <div className="space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <p className="text-sm font-medium truncate">
                        {entry.items.map(i => i.name).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                </div>
              )}
              {error && (
                <div className="flex justify-center">
                  <p className="text-red-500 bg-red-100 dark:bg-red-900/20 px-4 py-2 rounded-lg">
                    {error}
                  </p>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4">
              {showItemsInput ? (
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={item.id} className="relative">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(item.id, e.target.value)}
                        placeholder={`Item ${index + 1}`}
                        className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        disabled={isLoading}
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="absolute right-2 top-2 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Additional notes"
                    className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    rows={2}
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Get Instructions
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    placeholder="Ask follow-up questions about recycling..."
                    className="flex-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
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
