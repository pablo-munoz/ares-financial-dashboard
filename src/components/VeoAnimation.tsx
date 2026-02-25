import React, { useState, useEffect } from 'react';
import { Video, Upload, Loader2, Plus, TrendingUp, ShieldAlert, Key } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '../lib/utils';

export const VeoAnimation: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [ticker, setTicker] = useState('');
  const [mode, setMode] = useState<'upload' | 'ticker'>('upload');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [prompt, setPrompt] = useState('Animate this stock chart, adding glowing green "BUY 🚀" zones and red "SELL 😡" zones that move with the price action. Add technical indicators and cinematic data overlays.');
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasKey(true); // Proceed assuming success as per instructions
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateChartImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Set dark theme
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Draw mock candlesticks
    const padding = 50;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const count = 30;
    const candleWidth = chartWidth / count;

    let lastClose = canvas.height / 2;
    for (let i = 0; i < count; i++) {
      const x = padding + i * candleWidth;
      const open = lastClose;
      const close = open + (Math.random() - 0.5) * 60;
      const high = Math.max(open, close) + Math.random() * 20;
      const low = Math.min(open, close) - Math.random() * 20;
      
      const isUp = close > open;
      ctx.strokeStyle = isUp ? '#10b981' : '#f43f5e';
      ctx.fillStyle = isUp ? '#10b981' : '#f43f5e';
      
      // Wick
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, low);
      ctx.lineTo(x + candleWidth / 2, high);
      ctx.stroke();
      
      // Body
      ctx.fillRect(x + 2, Math.min(open, close), candleWidth - 4, Math.abs(close - open));
      
      lastClose = close;
    }

    // Draw Ticker Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(ticker || 'ARES', padding, padding + 40);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Ares Intelligence Analysis', padding, padding + 70);

    return canvas.toDataURL('image/png');
  };

  const generateVideo = async () => {
    let sourceImage = image;
    if (mode === 'ticker') {
      sourceImage = generateChartImage();
    }

    if (!sourceImage) {
      alert("Please provide an image or ticker first.");
      return;
    }

    setIsGenerating(true);
    setVideoUrl(null);

    try {
      // Use process.env.API_KEY for Veo models as per instructions
      const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey! });
      const base64Data = sourceImage.split(',')[1];
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
          imageBytes: base64Data,
          mimeType: 'image/png',
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(downloadLink, {
          method: 'GET',
          headers: { 'x-goog-api-key': apiKey! },
        });
        const blob = await response.blob();
        setVideoUrl(URL.createObjectURL(blob));
      }
    } catch (error: any) {
      console.error("Video generation failed:", error);
      if (error.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        alert("API Key session expired or invalid. Please re-select your key.");
      } else {
        alert("Failed to generate video. Please check your API key and try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-bold font-display">AI Visualizer (Veo)</h2>
        <p className="text-slate-500">Animate your financial charts or office photos into cinematic videos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {!hasKey && (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl space-y-4">
              <div className="flex items-center gap-3 text-amber-800">
                <Key className="w-5 h-5" />
                <p className="font-bold">Paid API Key Required</p>
              </div>
              <p className="text-sm text-amber-700">
                Veo video generation requires a paid Google Cloud project API key. 
                Please select your key to enable this feature.
              </p>
              <button 
                onClick={handleOpenKeySelector}
                className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
              >
                Select API Key
              </button>
              <p className="text-[10px] text-amber-600 text-center">
                Learn more about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline">Gemini API billing</a>.
              </p>
            </div>
          )}

          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button 
              onClick={() => setMode('upload')}
              className={cn(
                "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                mode === 'upload' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
              )}
            >
              Upload Graph
            </button>
            <button 
              onClick={() => setMode('ticker')}
              className={cn(
                "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                mode === 'ticker' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
              )}
            >
              Ticker Analysis
            </button>
          </div>

          {mode === 'upload' ? (
            <div 
              className={cn(
                "aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-all relative overflow-hidden",
                image ? "border-ares-green bg-white" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              )}
            >
              {image ? (
                <>
                  <img src={image} alt="Upload" className="absolute inset-0 w-full h-full object-cover opacity-20" />
                  <img src={image} alt="Upload" className="relative z-10 max-h-full rounded-xl shadow-lg" />
                  <button 
                    onClick={() => setImage(null)}
                    className="absolute top-4 right-4 z-20 p-2 bg-white rounded-full shadow-md text-rose-500 hover:bg-rose-50"
                  >
                    <Plus className="rotate-45" />
                  </button>
                </>
              ) : (
                <>
                  <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                    <Upload className="w-8 h-8 text-ares-green" />
                  </div>
                  <p className="font-bold text-slate-700">Upload an image</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 10MB</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Stock Ticker</label>
                <input 
                  type="text" 
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="w-full p-4 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-ares-green font-bold text-lg"
                  placeholder="e.g. TSLA, AAPL, BTC"
                />
              </div>
              <div className="aspect-video bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex items-center justify-center">
                <canvas 
                  ref={canvasRef} 
                  width={640} 
                  height={360} 
                  className="w-full h-full"
                  style={{ display: ticker ? 'block' : 'none' }}
                />
                {!ticker && (
                  <div className="text-center p-8">
                    <TrendingUp className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-sm text-slate-500">Enter a ticker to generate a base chart for analysis.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Animation Prompt</label>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full p-4 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-ares-green h-32 resize-none"
              placeholder="Describe how you want the image to move..."
            />
          </div>

          <button 
            onClick={generateVideo}
            disabled={(mode === 'upload' && !image) || (mode === 'ticker' && !ticker) || isGenerating}
            className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Crafting Analysis Video...
              </>
            ) : (
              <>
                <Video className="w-5 h-5" /> Generate AI Analysis
              </>
            )}
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-ares-green" /> Result Preview
          </h3>
          <div className="flex-1 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden relative">
            {videoUrl ? (
              <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
            ) : isGenerating ? (
              <div className="text-center space-y-4 p-8">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 border-4 border-ares-green/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-ares-green rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="text-sm text-slate-500 font-medium">Veo is crafting your cinematic analysis. This usually takes 30-60 seconds.</p>
              </div>
            ) : (
              <div className="text-center p-8">
                <Video className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm text-slate-400">Your generated video will appear here.</p>
              </div>
            )}
          </div>
          <div className="mt-6 p-4 bg-ares-green/5 rounded-2xl border border-ares-green/10">
            <p className="text-xs text-ares-dark-green font-bold flex items-center gap-2">
              <ShieldAlert className="w-3 h-3" /> AI Generation Tip
            </p>
            <p className="text-[10px] text-slate-500 mt-1">The AI will automatically identify key support and resistance levels to draw the "Buy" and "Sell" zones based on your prompt.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
