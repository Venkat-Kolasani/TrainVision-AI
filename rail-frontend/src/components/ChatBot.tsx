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
    text: 'Hello! I\'m your Rail Optimization Assistant. I can help you understand the optimization results and compare the schedule changes. What would you like to know?',
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
      const autoExplanationPrompt = `Please explain what just happened: ${lastAction}. 
      
      Analyze the recent logs and schedule changes to provide a clear explanation of:
      1. What action was taken
      2. Why it was approved or rejected
      3. What impact it had on the system
      4. Any conflicts that were resolved
      
      Keep the explanation concise but informative.`;
      
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
      const contextualPrompt = `You are an AI assistant for a train scheduling system. 
      The user wants to understand: "${prompt}" 
      
      Context:
      - Recent action: ${lastAction}
      - Schedule data: ${JSON.stringify(scheduleData || 'No schedule data available')}
      - Recent logs: ${JSON.stringify(logsAfter?.slice(-5) || 'No logs available')}
      
      Please provide a clear, concise explanation of what happened and why. Focus on:
      1. The specific action taken
      2. Whether it was successful or rejected and why
      3. Any system optimizations or conflict resolutions
      4. Impact on train schedules and delays
      
      Use simple language and bullet points where helpful.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
      const prompt = `You are an AI assistant for a train scheduling system. 
      The user has asked: "${userInput}" 
      
      Context:
      - Recent action: ${lastAction || 'No recent actions'}
      - Schedule data: ${JSON.stringify(scheduleData || 'No schedule data available')}
      - Logs before optimization: ${JSON.stringify(logsBefore?.slice(-3) || 'No logs available')}
      - Logs after optimization: ${JSON.stringify(logsAfter?.slice(-3) || 'No logs available')}
      
      Please provide a helpful response based on the available data. If the user is asking about recent changes, focus on explaining the optimization decisions and conflict resolutions.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
          Powered by Gemini AI. Responses may take a moment.
        </p>
      </div>
    </div>
  );
}
