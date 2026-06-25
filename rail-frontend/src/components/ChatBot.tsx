import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface LogEntry {
  timestamp: string;
  action: string;
  details: string;
}

interface ScheduleResponse {
  schedule: any[];
  delays_before_min: number[];
  delays_after_min: number[];
  reasons?: string[];
}

interface ChatBotProps {
  logsBefore: LogEntry[];
  logsAfter: LogEntry[];
  scheduleData?: ScheduleResponse | null;
  lastAction?: string | null;
  autoExplain?: boolean;
  onClose: () => void;
  onAutoExplanationComplete?: () => void;
}

export function ChatBot({ logsBefore, logsAfter, scheduleData, lastAction, autoExplain, onClose, onAutoExplanationComplete }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([{
    id: '1',
    text: '👋 Hi there! I\'m your Railway Operations Assistant. \n\nI can help you understand:\n🚂 What happened with recent train schedule changes\n🔧 Why the system made certain optimization decisions\n📊 How conflicts were resolved\n🚉 What\'s happening at specific stations\n\nJust ask me anything about your railway operations - I\'ll explain it in simple terms!',
    sender: 'bot',
    timestamp: new Date()
  }]);
  const [hasAutoExplained, setHasAutoExplained] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-explanation when override/conflict occurs
  useEffect(() => {
    if (autoExplain && lastAction && !hasAutoExplained) {
      setHasAutoExplained(true);

      // Generate automatic explanation
      const autoExplanationPrompt = `Something just happened in the railway system: ${lastAction}
      
      Please explain this in a friendly, easy-to-understand way. I want to know:
      - What exactly happened?
      - Was this a good thing or did something go wrong?
      - How does this affect train operations?
      - Should I be concerned about anything?
      
      Explain it like you're talking to someone who manages the station but isn't a technical expert.`;

      // Add auto-explanation request
      const autoMessage: Message = {
        id: Date.now().toString(),
        text: autoExplanationPrompt,
        sender: 'user',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, autoMessage]);

      // Trigger AI response
      handleAutoExplanation();
    }
  }, [autoExplain, lastAction, hasAutoExplained]);

  const handleAutoExplanation = async () => {
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('API key is not configured');
      }

      // Prepare a concise auto-explanation prompt
      const contextualPrompt = `Explain what just happened in the railway system in simple terms.

      Recent Action: ${lastAction}
      Current Data: ${JSON.stringify(scheduleData?.schedule?.slice(0, 2) || 'No data')}
      
      Keep explanation under 100 words. Focus on:
      - What specific action occurred
      - Which trains/stations were affected  
      - Why the system made this decision
      - Current impact on operations
      
      Use simple language and reference specific train IDs and stations from the data.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: contextualPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error?.message || 'Failed to get response from AI');
      }

      const data = await response.json();
      const botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'I apologize, but I was unable to process the explanation request. Please try asking me directly about what happened.';

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `🤖 **Auto-Explanation:**\n\n${botResponse}`,
        sender: 'bot',
        timestamp: new Date()
      }]);

      // Notify parent that auto-explanation is complete
      if (onAutoExplanationComplete) {
        onAutoExplanationComplete();
      }
    } catch (error) {
      console.error('Error in auto-explanation:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `I'm sorry, I encountered an error while generating the explanation: ${errorMessage}. Please feel free to ask me directly about what happened.`,
        sender: 'bot',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchCurrentSystemData = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

      // Fetch current schedule, trains, and conflicts
      const [scheduleRes, trainsRes, conflictsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/schedule`),
        fetch(`${API_BASE}/trains`),
        fetch(`${API_BASE}/conflicts`),
        fetch(`${API_BASE}/log`)  // Note: singular 'log', not 'logs'
      ]);

      const currentSchedule = scheduleRes.ok ? await scheduleRes.json() : null;
      const currentTrains = trainsRes.ok ? await trainsRes.json() : null;
      const currentConflicts = conflictsRes.ok ? await conflictsRes.json() : null;
      const currentLogs = logsRes.ok ? await logsRes.json() : null;

      return {
        schedule: currentSchedule,
        trains: currentTrains,
        conflicts: currentConflicts,
        logs: currentLogs
      };
    } catch (error) {
      console.error('Error fetching current system data:', error);
      return null;
    }
  };

  const handleSend = useCallback(async () => {
    const userInput = input.trim();
    if (!userInput) return;

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userInput,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('API key is not configured');
      }

      // Fetch current system data if we don't have enough context
      let currentData = null;
      if (!scheduleData || !logsBefore?.length) {
        currentData = await fetchCurrentSystemData();
      }

      // Prepare a more concise prompt to avoid token limits
      const scheduleInfo = currentData?.schedule || scheduleData;
      const trainsInfo = currentData?.trains;
      const conflictsInfo = currentData?.conflicts;

      // Create a summary instead of full JSON to avoid token limits
      const systemSummary = {
        totalTrains: trainsInfo?.length || (Array.isArray(trainsInfo) ? trainsInfo.length : 'Unknown'),
        activeConflicts: conflictsInfo?.conflicts?.length || conflictsInfo?.length || 0,
        scheduledTrains: scheduleInfo?.schedule?.length || 0,
        stations: ['HYB', 'SC', 'KCG'] // Known stations
      };

      const prompt = `You are a railway operations assistant. Answer the user's question about the current dashboard data.

      User Question: "${userInput}"
      
      CURRENT DASHBOARD DATA:
      - Trains: ${systemSummary.totalTrains} active trains
      - Conflicts: ${systemSummary.activeConflicts} current conflicts  
      - Stations: ${systemSummary.stations.join(', ')}
      - Recent Action: ${lastAction || 'No recent actions'}
      
      Key Train Details: ${trainsInfo ? JSON.stringify(trainsInfo.slice(0, 3)) : 'No data'}
      Current Schedule: ${scheduleInfo?.schedule ? JSON.stringify(scheduleInfo.schedule.slice(0, 3)) : 'No data'}
      
      INSTRUCTIONS:
      - Keep response under 150 words
      - Focus ONLY on what's currently shown in the dashboard
      - Reference specific trains (T101, T104, etc.) and stations (HYB, SC, KCG) from the data
      - Explain in simple, practical terms
      - If asked about optimization, explain what the system is currently doing with the visible data
      - Don't give general explanations - stick to the actual current data`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error?.message || `API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Gemini Response:', data); // Debug log

      const botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!botResponse) {
        console.error('No response text from Gemini:', data);
        throw new Error('Gemini returned an empty response. This might be due to content filtering or API limits.');
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `I'm sorry, I encountered an error: ${errorMessage}. Please try again.`,
        sender: 'bot',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      // Focus the textarea after sending a message
      textareaRef.current?.focus();
    }
  }, [input, logsBefore, logsAfter, scheduleData]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-96 flex-col rounded-lg border border-slate-600 bg-surface-2 shadow-xl" style={{ height: '600px' }}>
      <div className="flex items-center justify-between rounded-t-lg bg-primary p-4 text-white">
        <div className="flex items-center space-x-2">
          <img src="/train-logo.png" alt="TrainVision AI" className="h-5 w-5 brightness-0 invert" />
          <h3 className="font-semibold">TrainVision AI Assistant</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-white hover:bg-primary-light"
          aria-label="Close chat"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages?.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.sender === 'user'
                  ? 'bg-primary text-white'
                  : 'border border-slate-600 bg-surface-3 text-slate-100'
              }`}
            >
              <p className="whitespace-pre-line">{message.text}</p>
              <p className={`mt-1 text-xs ${message.sender === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg border border-slate-600 bg-surface-3 p-3">
              <div className="flex space-x-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-600 p-4">
        <div className="flex items-end space-x-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the optimization results..."
            className="flex-1 rounded-lg border border-slate-600 bg-slate-900 p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-primary p-3 text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">
          Powered by Gemini AI • Try: &quot;Explain what happened at HYB station&quot;
        </p>
      </div>
    </div>
  );
}
