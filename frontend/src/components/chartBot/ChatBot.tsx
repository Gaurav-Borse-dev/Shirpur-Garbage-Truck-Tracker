import React, { useState } from 'react'
import { 
  getTruckLocation, 
  getTruckETA, 
  getTruckStatus, 
  getTruckRoute 
} from '@/lib/chatbot.functions'
import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import { X, MessageCircle, MapPin, Clock, Route, Truck, Bell, Calendar, User, HelpCircle } from 'lucide-react'

// ... rest of your component code

const handleQuestionSelect = async (question: { id: string; text: string; action: string }) => {
  // Add user message
  const userMsg: Message = {
    id: Date.now().toString(),
    type: 'user',
    text: question.text,
  }
  setMessages(prev => [...prev, userMsg])
  setIsLoading(true)

  try {
    let response: { text: string; data?: any } = { text: '' }

    switch (question.action) {
      case 'getLocation':
        response = await getTruckLocation(user?.id || '')
        break
      case 'getETA':
        response = await getTruckETA(user?.id || '')
        break
      case 'getStatus':
        response = await getTruckStatus(user?.id || '')
        break
      case 'getRoute':
        response = await getTruckRoute(user?.id || '')
        break
      default:
        response = { text: 'This feature is coming soon!' }
    }

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      text: response.text,
      data: response.data,
    }
    setMessages(prev => [...prev, botMsg])
  } catch (error) {
    console.error('Error processing question:', error)
    const errorMsg: Message = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      text: 'I apologize, but I encountered an error. Please try again.',
    }
    setMessages(prev => [...prev, errorMsg])
  } finally {
    setIsLoading(false)
    setSelectedCategory(null)
  }
}

// ... rest of your component