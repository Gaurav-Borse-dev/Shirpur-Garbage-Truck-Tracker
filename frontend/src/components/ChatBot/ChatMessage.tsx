export interface ChatMessageProps {
  type: "bot" | "user";
  content: string;
}

export function ChatMessage({ type, content }: ChatMessageProps) {
  const isBot = type === "bot";

  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"} mb-4`}>
      <div
        className={`max-w-xs px-4 py-2 rounded-lg ${isBot ? "bg-gray-200 text-gray-900" : "bg-green-600 text-white"}`}
      >
        <p className="text-sm break-words">{content}</p>
      </div>
    </div>
  );
}
