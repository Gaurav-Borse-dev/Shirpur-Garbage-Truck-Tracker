import { useChatBot } from "@/store/chatbot";
import { useI18n } from "@/store/i18n";
import { GREETINGS } from "@/lib/chatbot.utils";
import { ChatMessage } from "./ChatMessage";
import { CategoryGrid } from "./CategoryGrid";
import { QuestionList } from "./QuestionList";
import { ResponseDisplay } from "./ResponseDisplay";
import { X } from "lucide-react";

export function ChatBotWindow() {
  const { isOpen, close, view } = useChatBot();
  const lang = useI18n((s) => s.lang);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40" 
        onClick={close}
      />
      
      {/* Window - Properly positioned to not get cut off */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-[90vw] max-w-sm h-[90vh] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-2xl flex-shrink-0">
          <h2 className="font-bold text-lg">CleanTrack</h2>
          <button 
            onClick={close} 
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {view === "greeting" && (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="text-5xl mb-4">👋</div>
              <p className="text-gray-700 font-medium mb-6 text-sm">
                {GREETINGS[lang]}
              </p>
              <div className="w-full">
                <CategoryGrid />
              </div>
            </div>
          )}

          {view === "categories" && (
            <div className="p-4">
              <div className="text-center text-sm text-gray-600 mb-4">
                How can we help you?
              </div>
              <CategoryGrid />
            </div>
          )}

          {view === "questions" && <QuestionList />}

          {view === "response" && <ResponseDisplay />}
        </div>
      </div>
    </>
  );
}
