import { useState, useEffect, useCallback, useRef } from 'react';
import AudioDecoder from '@/lib/audioDecoder';

interface ReceivedMessage {
  id: string;
  text: string;
  timestamp: string;
  category?: string;
  signalStrength?: number;
  confidence?: number;
}

interface UseAudioReceiverState {
  isListening: boolean;
  isInitialized: boolean;
  error: string | null;
  signalStrength: number;
  messages: ReceivedMessage[];
  permissionGranted: boolean;
  permissionDenied: boolean;
  headphonesConnected: boolean;
  isRequestingPermission: boolean;
}

export function useAudioReceiver() {
  const decoderRef = useRef<AudioDecoder | null>(null);
  const decodingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdCounterRef = useRef<number>(0);

  const [state, setState] = useState<UseAudioReceiverState>({
    isListening: false,
    isInitialized: false,
    error: null,
    signalStrength: 0,
    messages: [],
    permissionGranted: false,
    permissionDenied: false,
    headphonesConnected: false,
    isRequestingPermission: false,
  });

  // Initialize decoder
  useEffect(() => {
    const initializeDecoder = async () => {
      try {
        // Check if audio is available
        const audioAvailable = await AudioDecoder.isAudioAvailable();
        if (!audioAvailable) {
          setState((prev) => ({
            ...prev,
            error: 'لا يتوفر جهاز إدخال صوتي على هذا الجهاز',
            isInitialized: true,
          }));
          return;
        }

        // Check if headphones are connected
        const headphonesConnected = await AudioDecoder.areHeadphonesConnected();

        decoderRef.current = new AudioDecoder({
          numChannels: 1000,
          freqMin: 300,
          freqMax: 15000,
          sampleRate: 44100,
        });

        setState((prev) => ({
          ...prev,
          isInitialized: true,
          headphonesConnected,
          error: null,
        }));
      } catch (error) {
        console.error('Failed to initialize decoder:', error);
        setState((prev) => ({
          ...prev,
          isInitialized: true,
          error: 'فشل في تهيئة نظام الاستقبال',
        }));
      }
    };

    initializeDecoder();

    return () => {
      if (decoderRef.current) {
        decoderRef.current.stopListening();
      }
    };
  }, []);

  // Request microphone permission
  const requestMicrophonePermission = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isRequestingPermission: true,
      error: null,
    }));

    try {
      if (!decoderRef.current) {
        throw new Error('Decoder not initialized');
      }

      await decoderRef.current.startListening();

      setState((prev) => ({
        ...prev,
        permissionGranted: true,
        permissionDenied: false,
        isRequestingPermission: false,
        error: null,
      }));

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'فشل في الحصول على صلاحية الميكروفون';

      setState((prev) => ({
        ...prev,
        permissionDenied: true,
        permissionGranted: false,
        isRequestingPermission: false,
        error: errorMessage,
      }));

      return false;
    }
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    if (!state.permissionGranted) {
      const granted = await requestMicrophonePermission();
      if (!granted) {
        return;
      }
    }

    if (state.isListening) {
      return;
    }

    try {
      if (!decoderRef.current) {
        throw new Error('Decoder not initialized');
      }

      // Start decoding interval
      decodingIntervalRef.current = setInterval(async () => {
        try {
          const message = await decoderRef.current!.decodeRealtime();

          if (message && message.text.length > 0) {
            const newMessage: ReceivedMessage = {
              id: `msg_${Date.now()}_${messageIdCounterRef.current++}`,
              text: message.text,
              timestamp: message.timestamp,
              signalStrength: message.signalStrength,
              confidence: message.confidence,
              category: categorizeMessage(message.text),
            };

            setState((prev) => ({
              ...prev,
              messages: [newMessage, ...prev.messages],
            }));

            // Save to localStorage
            saveMessageToStorage(newMessage);
          }

          // Update signal strength
          const signalStrength = decoderRef.current!.getCurrentSignalStrength();
          setState((prev) => ({
            ...prev,
            signalStrength,
          }));
        } catch (error) {
          console.error('Error during decoding:', error);
        }
      }, 500); // Decode every 500ms

      setState((prev) => ({
        ...prev,
        isListening: true,
        error: null,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'فشل في بدء الاستقبال';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }));
    }
  }, [state.isListening, state.permissionGranted, requestMicrophonePermission]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (decodingIntervalRef.current) {
      clearInterval(decodingIntervalRef.current);
      decodingIntervalRef.current = null;
    }

    if (decoderRef.current) {
      decoderRef.current.stopListening();
    }

    setState((prev) => ({
      ...prev,
      isListening: false,
    }));
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
    }));
    localStorage.removeItem('receivedRadioMessages');
  }, []);

  // Load messages from storage
  useEffect(() => {
    const loadMessages = () => {
      try {
        const stored = localStorage.getItem('receivedRadioMessages');
        if (stored) {
          const messages = JSON.parse(stored);
          setState((prev) => ({
            ...prev,
            messages,
          }));
        }
      } catch (error) {
        console.error('Failed to load messages from storage:', error);
      }
    };

    loadMessages();
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    clearMessages,
    requestMicrophonePermission,
  };
}

/**
 * Categorize message based on content
 */
function categorizeMessage(text: string): string {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes('tech') ||
    lowerText.includes('computer') ||
    lowerText.includes('software')
  ) {
    return 'tech';
  }
  if (lowerText.includes('health') || lowerText.includes('medical')) {
    return 'health';
  }
  if (lowerText.includes('education') || lowerText.includes('learn')) {
    return 'education';
  }
  if (lowerText.includes('news') || lowerText.includes('breaking')) {
    return 'news';
  }
  if (lowerText.includes('tip') || lowerText.includes('advice')) {
    return 'tips';
  }

  return 'general';
}

/**
 * Save message to localStorage
 */
function saveMessageToStorage(message: ReceivedMessage): void {
  try {
    const stored = localStorage.getItem('receivedRadioMessages');
    const messages = stored ? JSON.parse(stored) : [];
    messages.unshift(message);

    // Keep only last 100 messages
    if (messages.length > 100) {
      messages.pop();
    }

    localStorage.setItem('receivedRadioMessages', JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save message to storage:', error);
  }
}
