import { useChatBot } from "@/store/chatbot";
import { useI18n } from "@/store/i18n";
import { CATEGORY_QUESTIONS, getLabel } from "@/lib/chatbot.utils";
import { ChevronLeft } from "lucide-react";

export function QuestionList() {
  const { selectedCategory, selectQuestion, setView } = useChatBot();
  const lang = useI18n((s) => s.lang);

  if (!selectedCategory) return null;

  const questions = CATEGORY_QUESTIONS[selectedCategory as keyof typeof CATEGORY_QUESTIONS] || [];

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
        <h3 className="font-semibold text-sm flex-1">Questions</h3>
      </div>

      {/* Questions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {questions && questions.length > 0 ? (
          questions.map((question) => (
            <button
              key={question.id}
              onClick={() => selectQuestion(question.id)}
              className="w-full p-3 text-left bg-green-50 hover:bg-green-100 active:bg-green-200 rounded-lg transition-colors text-sm text-gray-800 font-medium border border-green-200"
            >
              {getLabel(question.label, lang)}
            </button>
          ))
        ) : (
          <div className="text-center text-gray-500 text-sm mt-4">
            No questions available
          </div>
        )}
      </div>
    </div>
  );
}
