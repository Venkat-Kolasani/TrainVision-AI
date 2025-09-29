import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, X } from 'lucide-react';

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
      handleAutoExplanation(autoExplanationPrompt);
    }
  }, [autoExplain, lastAction, hasAutoExplained]);

  const handleAutoExplanation = async (prompt: string) => {
    setIsLoading(true);
    
    try {
      const apiKey = 'AIzaSyBuLZBgvKK9a1q1S_ggpSOeQ2D10wWaPdM';
      if (!apiKey) {
        throw new Error('API key is not configured');
      }

      // Prepare the prompt with context
      const contextualPrompt = `You are a friendly railway operations expert helping someone understand what just happened in their train scheduling system. 

      The user wants to understand: "${prompt}"
      
      Here's what happened:
      - Recent action: ${lastAction}
      - Schedule data: ${JSON.stringify(scheduleData || 'No schedule data available')}
      - Recent logs: ${JSON.stringify(logsAfter?.slice(-5) || 'No logs available')}
      
      Please explain this in a conversational, easy-to-understand way as if you're talking to someone who isn't a technical expert. Focus on:
      
      🚂 **What happened?** - Describe the action in simple terms
      ✅ **Was it successful?** - Did it work as intended or was there an issue?
      🔧 **Why did the system do this?** - Explain the reasoning behind any optimizations
      📊 **What's the impact?** - How does this affect train schedules, delays, or passengers?
      
      Use friendly language, emojis where appropriate, and avoid technical jargon. Think of explaining this to a station manager who needs to understand the practical implications.`;

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
      const apiKey = 'AIzaSyCD8h5TjkB40XBwjybfKDmc9GPGb2Q2COE';
      if (!apiKey) {
        throw new Error('API key is not configured');
      }

      // Prepare the prompt with context
      const prompt = `You are a friendly railway operations expert helping someone understand their train scheduling system. 

      The user asked: "${userInput}"
      
      Current situation:
      - Recent action: ${lastAction || 'No recent actions'}
      - Schedule data: ${JSON.stringify(scheduleData || 'No schedule data available')}
      - What happened before: ${JSON.stringify(logsBefore?.slice(-3) || 'No previous logs')}
      - What happened after: ${JSON.stringify(logsAfter?.slice(-3) || 'No recent logs')}
      
      Please respond in a conversational, helpful way. Use these guidelines:
      
      🎯 **Be conversational** - Talk like you're explaining to a colleague, not writing a technical manual
      🚂 **Use railway context** - Reference trains, stations, platforms, and schedules in relatable terms
      📊 **Explain the "why"** - When discussing optimizations, explain the reasoning in practical terms
      💡 **Give actionable insights** - Help them understand what they can do or what to expect next
      🔍 **Break down complex concepts** - If discussing conflicts or optimizations, use simple analogies
      
      If they're asking about specific stations (like HYB, SC, KCG), explain what's happening there in terms of train movements, platform assignments, and any scheduling decisions.
      
      Avoid technical jargon and focus on the practical impact on train operations and passenger experience.`;

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
        throw new Error(errorData.error?.message || 'Failed to get response from AI');
      }
      
      const data = await response.json();
      const botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 
                         'I apologize, but I was unable to process your request. Please try again.';

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
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-xl flex flex-col" style={{ height: '600px' }}>
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5" />
          <h3 className="font-semibold">Rail Optimization Assistant</h3>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-blue-700 p-1 rounded-full"
          aria-label="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages?.map((message) => (
          <div 
            key={message.id} 
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg p-3 ${
                message.sender === 'user' 
                  ? 'bg-blue-100 text-blue-900' 
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="whitespace-pre-line">{message.text}</p>
              <p className="text-xs text-gray-500 mt-1">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t">
        <div className="flex items-end space-x-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the optimization results..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            disabled={isLoading}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Powered by Gemini AI • Try asking: "Explain what happened at HYB station" or "Why was this train moved?"
        </p>
      </div>
    </div>
  );
}
