import { useLocation } from "@tanstack/react-router";
import { ChatBotButton } from "./ChatBotButton";
import { ChatBotWindow } from "./ChatBotWindow";

export function ChatBot() {
  const location = useLocation();

  // Only show on resident pages
  const isResidentPage = location.pathname.startsWith("/resident");

  if (!isResidentPage) {
    return null; // Hide from all other pages
  }

  return (
    <>
      <ChatBotButton />
      <ChatBotWindow />
    </>
  );
}
