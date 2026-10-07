import { useChatBot } from "@/store/chatbot";
import { ChatMessage } from "./ChatMessage";
import { Loader2, ChevronLeft } from "lucide-react";
import { useChatBotResponse } from "@/hooks/useChatBotResponse";

export function ResponseDisplay() {
  const { setView, isLoading, error, messages } = useChatBot();

  // Hook handles fetching data
  useChatBotResponse();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b bg-gray-50">
        <button
          onClick={() => setView("categories")}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="font-semibold text-sm flex-1">Response</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 size={40} className="animate-spin text-green-600 mx-auto mb-3" />
              <p className="text-sm text-gray-600">Fetching answer...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-3">
            {messages
              .filter((m) => m.type === "bot")
              .map((msg) => (
                <ChatMessage key={msg.id} type={msg.type} content={msg.content} />
              ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm mt-4">No response yet</div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <button
          onClick={() => setView("categories")}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Back to Categories
        </button>
      </div>
    </div>
  );
}
