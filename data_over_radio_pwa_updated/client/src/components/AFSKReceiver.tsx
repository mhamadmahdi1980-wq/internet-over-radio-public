import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, Copy, Trash2, Volume2 } from 'lucide-react';
import { AFSKDecoder } from '@/lib/afskDecoder';

interface ReceivedMessage {
  id: string;
  text: string;
  timestamp: string;
  signalStrength: number;
}

export function AFSKReceiver() {
  const [isListening, setIsListening] = useState(false);
  const [decodedText, setDecodedText] = useState('');
  const [receivedMessages, setReceivedMessages] = useState<ReceivedMessage[]>([]);
  const [signalStrength, setSignalStrength] = useState(0);
  const decoderRef = useRef<AFSKDecoder | null>(null);
  const signalIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // تهيئة الـ Decoder
    decoderRef.current = new AFSKDecoder({
      markFreq: 1200,
      spaceFreq: 2200,
      baudRate: 1200,
      sampleRate: 44100,
    });

    return () => {
      if (decoderRef.current?.isActive()) {
        decoderRef.current.stopListening();
      }
    };
  }, []);

  const handleStartListening = async () => {
    try {
      if (!decoderRef.current) {
        decoderRef.current = new AFSKDecoder();
      }

      await decoderRef.current.startListening();

      // تعيين callback لعند فك تشفير نص جديد
      decoderRef.current.setOnTextDecoded((text) => {
        setDecodedText(text);
      });

      setIsListening(true);

      // محاكاة قوة الإشارة
      signalIntervalRef.current = setInterval(() => {
        setSignalStrength(Math.floor(Math.random() * 40) + 60);
      }, 1000);
    } catch (error) {
      console.error('خطأ في بدء الاستماع:', error);
      alert('لم يتمكن من الوصول للميكروفون. يرجى السماح بالوصول.');
    }
  };

  const handleStopListening = () => {
    if (decoderRef.current) {
      decoderRef.current.stopListening();
    }
    setIsListening(false);

    if (signalIntervalRef.current) {
      clearInterval(signalIntervalRef.current);
    }

    setSignalStrength(0);
  };

  const handleSaveMessage = () => {
    if (decodedText.trim()) {
      const newMessage: ReceivedMessage = {
        id: Date.now().toString(),
        text: decodedText,
        timestamp: new Date().toLocaleTimeString('ar-SA'),
        signalStrength,
      };

      setReceivedMessages([newMessage, ...receivedMessages]);
      setDecodedText('');
    }
  };

  const handleCopyText = () => {
    if (decodedText) {
      navigator.clipboard.writeText(decodedText);
      alert('تم نسخ النص');
    }
  };

  const handleClearText = () => {
    setDecodedText('');
    if (decoderRef.current) {
      decoderRef.current.resetDecodedText();
    }
  };

  const handleDeleteMessage = (id: string) => {
    setReceivedMessages(receivedMessages.filter((msg) => msg.id !== id));
  };

  const getSignalColor = () => {
    if (signalStrength > 70) return 'text-emerald-500';
    if (signalStrength > 40) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* قسم الاستقبال */}
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Mic size={24} className="text-purple-600" />
          استقبال نغمات AFSK
        </h3>

        <div className="space-y-4">
          {/* زر البدء/الإيقاف */}
          <div className="flex gap-2">
            {!isListening ? (
              <Button
                onClick={handleStartListening}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <Mic size={18} className="mr-2" />
                بدء الاستماع
              </Button>
            ) : (
              <Button
                onClick={handleStopListening}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                <Mic size={18} className="mr-2" />
                إيقاف الاستماع
              </Button>
            )}
          </div>

          {/* مؤشر قوة الإشارة */}
          {isListening && (
            <div className="bg-white rounded p-4 border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">قوة الإشارة:</span>
                <span className={`text-2xl font-bold ${getSignalColor()}`}>
                  {signalStrength}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    signalStrength > 70
                      ? 'bg-emerald-500'
                      : signalStrength > 40
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${signalStrength}%` }}
                />
              </div>
            </div>
          )}

          {/* منطقة النص المفكوك */}
          <div>
            <label className="block text-sm font-medium mb-2">النص المستقبل:</label>
            <div className="bg-white rounded p-4 border-2 border-purple-200 min-h-24">
              <p className="text-gray-900 break-words whitespace-pre-wrap">
                {decodedText || '(في انتظار النغمات...)'}
              </p>
            </div>
          </div>

          {/* أزرار التحكم */}
          {decodedText && (
            <div className="flex gap-2">
              <Button
                onClick={handleCopyText}
                variant="outline"
                className="flex-1"
              >
                <Copy size={18} className="mr-2" />
                نسخ
              </Button>
              <Button
                onClick={handleClearText}
                variant="outline"
                className="flex-1"
              >
                <Trash2 size={18} className="mr-2" />
                مسح
              </Button>
              <Button
                onClick={handleSaveMessage}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Volume2 size={18} className="mr-2" />
                حفظ
              </Button>
            </div>
          )}

          <div className="bg-purple-100 border border-purple-300 rounded p-3 text-sm text-purple-800">
            <p className="font-medium mb-1">💡 نصيحة:</p>
            <p>
              ضع الهاتف بجانب سماعة الراديو أو جهاز الإرسال. سيقوم التطبيق بفك تشفير النغمات تلقائياً وعرض النص
              المستقبل.
            </p>
          </div>
        </div>
      </Card>

      {/* قسم الرسائل المحفوظة */}
      {receivedMessages.length > 0 && (
        <Card className="p-6 bg-white border-2 border-gray-200">
          <h3 className="text-xl font-bold mb-4">الرسائل المحفوظة ({receivedMessages.length})</h3>

          <div className="space-y-3">
            {receivedMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200 flex items-start justify-between"
              >
                <div className="flex-1">
                  <p className="text-gray-900 mb-2">{msg.text}</p>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline">{msg.timestamp}</Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Volume2 size={12} />
                      {msg.signalStrength}%
                    </Badge>
                  </div>
                </div>
                <Button
                  onClick={() => handleDeleteMessage(msg.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
