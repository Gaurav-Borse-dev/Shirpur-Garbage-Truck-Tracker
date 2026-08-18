import { useChatBot } from "@/store/chatbot";

export function ChatBotButton() {
  const { isOpen, open } = useChatBot();

  if (isOpen) return null;

  return (
    <button
      onClick={open}
      className="fixed bottom-20 right-6 z-50 w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 text-white shadow-2xl hover:shadow-3xl transform hover:scale-125 transition-all duration-300 flex items-center justify-center group"
      aria-label="Open AI ChatBot"
      title="CleanTrack AI Assistant"
    >
      {/* Smiling Robot Icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8 group-hover:animate-bounce"
      >
        {/* Robot Head - Rectangle */}
        <rect x="4" y="5" width="16" height="13" rx="2" />
        
        {/* Left Eye */}
        <circle cx="9" cy="10" r="2" fill="currentColor" />
        
        {/* Right Eye */}
        <circle cx="15" cy="10" r="2" fill="currentColor" />
        
        {/* Happy Mouth - Smile */}
        <path d="M 9 13 Q 12 14.5 15 13" strokeWidth="1.5" fill="none" />
        
        {/* Left Antenna */}
        <line x1="8" y1="5" x2="6" y2="1" strokeWidth="2" />
        <circle cx="6" cy="1" r="1" fill="currentColor" />
        
        {/* Right Antenna */}
        <line x1="16" y1="5" x2="18" y2="1" strokeWidth="2" />
        <circle cx="18" cy="1" r="1" fill="currentColor" />
        
        {/* Chest Panel */}
        <rect x="7" y="14" width="10" height="4" rx="1" fill="none" />
        
        {/* Buttons on chest */}
        <circle cx="10" cy="16" r="0.8" fill="currentColor" opacity="0.6" />
        <circle cx="12" cy="16" r="0.8" fill="currentColor" opacity="0.6" />
        <circle cx="14" cy="16" r="0.8" fill="currentColor" opacity="0.6" />
      </svg>

      {/* Pulsing Indicator Dot */}
      <div className="absolute bottom-1 right-1 w-3 h-3 bg-yellow-300 rounded-full animate-pulse"></div>

      {/* Hover Tooltip */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-semibold">
        Ask CleanTrack AI
      </div>
    </button>
  );
}
