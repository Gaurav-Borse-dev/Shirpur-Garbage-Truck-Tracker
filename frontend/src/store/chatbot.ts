import { create } from 'zustand'

export type ChatBotView = 'greeting' | 'categories' | 'questions' | 'response'

export interface ChatMessage {
  id: string
  type: 'bot' | 'user'
  content: string
  timestamp: Date
}

interface ChatBotState {
  // UI State
  isOpen: boolean
  view: ChatBotView
  selectedCategory: string | null
  selectedQuestion: string | null
  
  // Messages
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  responseData: any | null
  
  // Actions
  open: () => void
  close: () => void
  setView: (view: ChatBotView) => void
  selectCategory: (categoryId: string) => void
  selectQuestion: (questionId: string) => void
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setResponseData: (data: any) => void
  reset: () => void
}

export const useChatBot = create<ChatBotState>((set) => ({
  // Initial state
  isOpen: false,
  view: 'greeting',
  selectedCategory: null,
  selectedQuestion: null,
  messages: [],
  isLoading: false,
  error: null,
  responseData: null,

  // Actions
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, view: 'greeting', selectedCategory: null, selectedQuestion: null, messages: [], responseData: null }),
  setView: (view) => set({ view }),
  selectCategory: (categoryId) =>
    set({
      selectedCategory: categoryId,
      view: 'questions',
      messages: [], // Clear messages when switching to questions
    }),
  selectQuestion: (questionId) =>
    set((state) => ({
      selectedQuestion: questionId,
      view: 'response',
      isLoading: true,
      messages: [], // Clear messages when switching to response
    })),
  addMessage: (message) =>
    set((state) => {
      // Check if message already exists
      const exists = state.messages.some((m) => m.content === message.content && m.type === message.type);
      if (exists) return state;
      
      return {
        messages: [...state.messages, message],
      };
    }),
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
  setResponseData: (data) => set({ responseData: data }),
  reset: () =>
    set({
      view: 'greeting',
      selectedCategory: null,
      selectedQuestion: null,
      messages: [],
      isLoading: false,
      error: null,
      responseData: null,
    }),
}))
