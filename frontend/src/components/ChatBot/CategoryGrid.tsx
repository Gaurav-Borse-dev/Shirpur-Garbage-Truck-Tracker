import { useChatBot } from "@/store/chatbot";
import { useI18n } from "@/store/i18n";
import { CHATBOT_CATEGORIES, getLabel } from "@/lib/chatbot.utils";

export function CategoryGrid() {
  const { selectCategory } = useChatBot();
  const lang = useI18n((s) => s.lang);

  return (
    <div className="grid grid-cols-2 gap-3 p-4 w-full auto-rows-max">
      {CHATBOT_CATEGORIES.map((category) => (
        <button
          key={category.id}
          onClick={() => selectCategory(category.id)}
          className="p-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 rounded-lg transition-all text-center flex flex-col items-center gap-2 min-h-[90px] justify-center"
        >
          <div className="text-2xl">{category.icon}</div>
          <div className="font-semibold text-gray-700 text-xs text-center line-clamp-2">
            {getLabel(category.label, lang)}
          </div>
        </button>
      ))}
    </div>
  );
}
