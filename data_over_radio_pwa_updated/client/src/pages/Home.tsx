import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Signal, Search, Heart, MessageSquare, RefreshCw, Globe, Image as ImageIcon, Youtube, Send, Radio, Settings } from 'lucide-react';

interface RadioPacket {
  id: string;
  type: 'WEB' | 'IMG' | 'YT' | 'ERR';
  url: string;
  data: string;
  timestamp: string;
  signalQuality: number;
}

export default function Home() {
  const [history, setHistory] = useState<RadioPacket[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<'browser' | 'history' | 'settings'>('browser');
  const [isListening, setIsListening] = useState(false);
  const [currentPacket, setCurrentPacket] = useState<RadioPacket | null>(null);

  const startListening = () => {
    setIsListening(true);
    // محاكاة التقاط نغمة راديو وفك تشفيرها
    setTimeout(() => {
      const newPacket: RadioPacket = {
        id: Math.random().toString(),
        type: urlInput.includes('youtube') ? 'YT' : 'WEB',
        url: urlInput || 'google.com',
        data: `محتوى تم استلامه عبر الراديو لـ ${urlInput || 'google.com'}. تم فك ضغط البيانات بنجاح وعرضها كصفحة ويب.`,
        timestamp: new Date().toLocaleTimeString('ar-SA'),
        signalQuality: Math.floor(Math.random() * 30) + 70
      };
      setCurrentPacket(newPacket);
      setHistory([newPacket, ...history]);
      setIsListening(false);
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Top Browser Bar */}
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
            <Radio size={24} className="text-white" />
          </div>
          <div className="flex-1 relative group">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-600 transition" size={20} />
            <Input 
              className="pl-11 pr-4 h-12 rounded-2xl border-zinc-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 bg-zinc-50/50 transition-all text-lg"
              placeholder="أدخل رابط الموقع (google.com)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startListening()}
            />
          </div>
          <Button 
            onClick={startListening} 
            disabled={isListening}
            className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
          >
            {isListening ? <RefreshCw className="animate-spin" /> : <Send size={20} />}
            <span className="mr-2 hidden sm:inline">طلب راديو</span>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-24">
        {currentPacket ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="overflow-hidden rounded-3xl border-0 shadow-2xl shadow-indigo-100/50">
              <div className="bg-indigo-600 p-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  {currentPacket.type === 'YT' ? <Youtube size={20} /> : <Globe size={20} />}
                  <span className="font-medium truncate max-w-[200px]">{currentPacket.url}</span>
                </div>
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-0">إشارة: {currentPacket.signalQuality}%</Badge>
              </div>
              <div className="p-8 bg-white min-h-[400px]">
                <div className="prose prose-indigo max-w-none">
                  <h1 className="text-3xl font-bold mb-6 text-zinc-800">نتائج البحث الإذاعي</h1>
                  <p className="text-lg leading-relaxed text-zinc-600">{currentPacket.data}</p>
                  
                  {currentPacket.type === 'YT' && (
                    <div className="mt-8 rounded-3xl bg-zinc-100 aspect-video flex flex-col items-center justify-center border-2 border-dashed border-zinc-300">
                      <Youtube size={64} className="text-red-500 mb-4 opacity-50" />
                      <p className="text-zinc-500 font-medium">مشغل يوتيوب الإذاعي (Frames Mode)</p>
                      <p className="text-xs text-zinc-400 mt-2">يتم استقبال الصور المتتالية حالياً...</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 bg-zinc-50 border-t flex justify-between items-center text-xs text-zinc-400">
                <span>استلام: {currentPacket.timestamp}</span>
                <Button variant="ghost" size="sm" onClick={() => setCurrentPacket(null)}>إغلاق الصفحة</Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="text-center py-16">
              <div className="inline-flex p-6 bg-indigo-50 rounded-full mb-6">
                <Search size={48} className="text-indigo-400" />
              </div>
              <h2 className="text-3xl font-bold text-zinc-800 mb-3">جاهز لاستقبال الإنترنت الإذاعي</h2>
              <p className="text-zinc-500 max-w-md mx-auto">أدخل الرابط أعلاه واضغط على "طلب راديو". سيعمل السيرفر السحابي على جلب البيانات وتحويلها لنغمات تصلك فوراً.</p>
            </div>

            {history.length > 0 && (
              <div className="animate-in fade-in duration-700">
                <h3 className="text-lg font-bold mb-4 text-zinc-700 flex items-center gap-2">
                  <RefreshCw size={18} /> الصفحات السابقة
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {history.map(item => (
                    <Card key={item.id} className="p-4 cursor-pointer hover:border-indigo-200 transition-all hover:shadow-lg group rounded-2xl border-zinc-200" onClick={() => setCurrentPacket(item)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-100 rounded-xl group-hover:bg-indigo-50 transition">
                            {item.type === 'YT' ? <Youtube size={20} className="text-red-500" /> : <Globe size={20} className="text-blue-500" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-800 truncate w-40">{item.url}</p>
                            <p className="text-xs text-zinc-400">{item.timestamp}</p>
                          </div>
                        </div>
                        <Signal size={16} className="text-emerald-500" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-3 flex justify-around items-center shadow-lg z-40">
        <button onClick={() => setActiveTab('browser')} className={`flex flex-col items-center gap-1 ${activeTab === 'browser' ? 'text-indigo-600' : 'text-zinc-400'}`}>
          <Globe size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">المتصفح</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 ${activeTab === 'history' ? 'text-indigo-600' : 'text-zinc-400'}`}>
          <RefreshCw size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">السجل</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-indigo-600' : 'text-zinc-400'}`}>
          <Settings size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">الإعدادات</span>
        </button>
      </nav>
    </div>
  );
}
