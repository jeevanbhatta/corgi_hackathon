'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
}

export default function ChatPanel({ messages, onSendMessage, isLoading }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[600px] w-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Repository Assistant</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto w-full p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center w-full h-full flex flex-col justify-center items-center text-gray-500">
            <p className="mb-4">Ask anything about the repository&apos;s history, architecture, or specific commits.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button 
                onClick={() => setInput("What are the major architectural shifts in this repo?")} 
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-full transition-colors text-gray-700"
              >
                What are the major architectural shifts in this repo?
              </button>
              <button 
                onClick={() => setInput("Why was the database migrated?")} 
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-full transition-colors text-gray-700"
              >
                Why was the database migrated?
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none shadow-sm' 
                  : 'bg-gray-100 text-gray-800 rounded-bl-none shadow-sm'
              }`}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="text-[15px] leading-relaxed break-words">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({node: _, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node: _, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                        ol: ({node: _, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                        li: ({node: _, ...props}) => <li className="mb-1" {...props} />,
                        strong: ({node: _, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                        code: ({node: _, className, children, ...props}) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match && !className?.includes('language-');
                          return isInline ? (
                            <code className="bg-gray-200 px-1 py-0.5 rounded text-sm font-mono text-gray-800" {...props}>
                              {children}
                            </code>
                          ) : (
                            <pre className="bg-gray-800 text-gray-100 p-3 rounded-lg overflow-x-auto text-sm my-2">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          );
                        },
                        a: ({node: _, ...props}) => <a className="text-blue-600 hover:underline" target="_blank" rel="noreferrer" {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 rounded-xl rounded-bl-none px-4 py-4 shadow-sm flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-full text-black"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={!input.trim() || isLoading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
