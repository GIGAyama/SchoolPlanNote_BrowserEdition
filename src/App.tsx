import React, { useState, useEffect, createContext, useContext, useCallback, useRef, useMemo } from 'react';
import { GoogleGenAI, Type as GenAIType } from "@google/genai";
import { get, set } from 'idb-keyval';
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, CheckSquare, Settings, Copy, Trash2, Plus, Download, Upload,
  CalendarDays, Newspaper, BarChart3, ChevronLeft, ChevronRight, 
  Save, Edit, X, RefreshCw, Type, Image as ImageIcon, LayoutTemplate,
  GripVertical, AlignLeft, AlignCenter, AlignRight, Printer, FileText,
  BookMarked, Sparkles, MoveUp, MoveDown, HelpCircle, ClipboardPaste, 
  History, Undo, Redo, Wand2, CalendarClock, Heading1, Heading2, MessageSquare, 
  Columns, QrCode, Minus, Calendar, Command, List, ListOrdered, Info
} from 'lucide-react';

// ==========================================
// 1. データ管理 & コンテキスト
// ==========================================
const STORAGE_KEY = 'giga_school_plan_note_premium_v2';

const STANDARD_HOURS: Record<number, {name: string, targetHours: number}[]> = {
  1: [
    { name: '国語', targetHours: 306 }, { name: '算数', targetHours: 136 },
    { name: '生活', targetHours: 102 }, { name: '音楽', targetHours: 68 },
    { name: '図画工作', targetHours: 68 }, { name: '体育', targetHours: 102 },
    { name: '道徳', targetHours: 34 }, { name: '特別活動', targetHours: 34 }
  ],
  2: [
    { name: '国語', targetHours: 315 }, { name: '算数', targetHours: 175 },
    { name: '生活', targetHours: 105 }, { name: '音楽', targetHours: 70 },
    { name: '図画工作', targetHours: 70 }, { name: '体育', targetHours: 105 },
    { name: '道徳', targetHours: 35 }, { name: '特別活動', targetHours: 35 }
  ],
  3: [
    { name: '国語', targetHours: 245 }, { name: '社会', targetHours: 70 },
    { name: '算数', targetHours: 175 }, { name: '理科', targetHours: 90 },
    { name: '音楽', targetHours: 60 }, { name: '図画工作', targetHours: 60 },
    { name: '体育', targetHours: 105 }, { name: '道徳', targetHours: 35 },
    { name: '特別活動', targetHours: 35 }, { name: '総合', targetHours: 70 },
    { name: '外国語活動', targetHours: 35 }
  ],
  4: [
    { name: '国語', targetHours: 245 }, { name: '社会', targetHours: 90 },
    { name: '算数', targetHours: 175 }, { name: '理科', targetHours: 105 },
    { name: '音楽', targetHours: 60 }, { name: '図画工作', targetHours: 60 },
    { name: '体育', targetHours: 105 }, { name: '道徳', targetHours: 35 },
    { name: '特別活動', targetHours: 35 }, { name: '総合', targetHours: 70 },
    { name: '外国語活動', targetHours: 35 }
  ],
  5: [
    { name: '国語', targetHours: 175 }, { name: '社会', targetHours: 100 },
    { name: '算数', targetHours: 175 }, { name: '理科', targetHours: 105 },
    { name: '音楽', targetHours: 50 }, { name: '図画工作', targetHours: 50 },
    { name: '家庭', targetHours: 60 }, { name: '体育', targetHours: 90 },
    { name: '道徳', targetHours: 35 }, { name: '特別活動', targetHours: 35 },
    { name: '総合', targetHours: 70 }, { name: '外国語', targetHours: 70 }
  ],
  6: [
    { name: '国語', targetHours: 175 }, { name: '社会', targetHours: 105 },
    { name: '算数', targetHours: 175 }, { name: '理科', targetHours: 105 },
    { name: '音楽', targetHours: 50 }, { name: '図画工作', targetHours: 50 },
    { name: '家庭', targetHours: 55 }, { name: '体育', targetHours: 90 },
    { name: '道徳', targetHours: 35 }, { name: '特別活動', targetHours: 35 },
    { name: '総合', targetHours: 70 }, { name: '外国語', targetHours: 70 }
  ]
};

const DEFAULT_SETTINGS = {
  schoolName: 'GIGA山市立 GIGA山小学校',
  grade: 3,
  classNumber: 1,
  teacherName: 'GIGA山 太郎',
  geminiApiKey: '',
  geminiModelName: 'gemini-2.5-flash',
  timetableRows: [
    { key: 'event', label: '行事', type: 'text' },
    { key: 'morning', label: '朝学習', type: 'text' },
    { key: 'period1', label: '1校時', type: 'multi' },
    { key: 'period2', label: '2校時', type: 'multi' },
    { key: 'period3', label: '3校時', type: 'multi' },
    { key: 'period4', label: '4校時', type: 'multi' },
    { key: 'period5', label: '5校時', type: 'multi' },
    { key: 'period6', label: '6校時', type: 'multi' },
    { key: 'afterschool', label: '放課後', type: 'text' },
    { key: 'homework', label: '宿題', type: 'text' },
    { key: 'items', label: '持ち物', type: 'text' }
  ],
  subjects: STANDARD_HOURS[3].map(s => ({...s})),
  baseTimetable: null,
  onboarding: { settings: false, plan: false, task: false, unit: false, newsletter: false, hours: false }
};

const AppContext = createContext();

function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<any>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const loadData = async () => {
      try {
        let saved = await get(STORAGE_KEY);
        if (!saved) {
          // localStorageからのマイグレーション
          const localSaved = localStorage.getItem(STORAGE_KEY);
          if (localSaved) {
            saved = JSON.parse(localSaved);
            await set(STORAGE_KEY, saved);
          }
        }
        
        if (saved) {
          const parsed = saved;
          if (parsed.settings) {
            if (parsed.settings.gradeClass && !parsed.settings.grade) {
              const match = parsed.settings.gradeClass.match(/(\d+)年(\d+)組/);
              if (match) {
                parsed.settings.grade = parseInt(match[1], 10);
                parsed.settings.classNumber = parseInt(match[2], 10);
              } else {
                parsed.settings.grade = 3;
                parsed.settings.classNumber = 1;
              }
              delete parsed.settings.gradeClass;
            }
            if (!parsed.settings.onboarding) {
              parsed.settings.onboarding = { settings: false, plan: false, task: false, unit: false, newsletter: false, hours: false };
            }
          }
          setData({ settings: DEFAULT_SETTINGS, weeklyPlans: {}, tasks: [], unitMaster: [], newsletters: [], ...parsed });
        } else {
          setData({ settings: DEFAULT_SETTINGS, weeklyPlans: {}, tasks: [], unitMaster: [], newsletters: [] });
        }
      } catch (e) {
        console.error("データ復元エラー", e);
        setData({ settings: DEFAULT_SETTINGS, weeklyPlans: {}, tasks: [], unitMaster: [], newsletters: [] });
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!data) return;
    const timeoutId = setTimeout(() => {
      set(STORAGE_KEY, data).catch(e => console.error("データ保存エラー", e));
    }, 500); // 500ms debounce
    return () => clearTimeout(timeoutId);
  }, [data]);

  const showToast = useCallback((message: string, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const updateData = useCallback((key: string, value: any) => {
    setData((prev: any) => ({ ...prev, [key]: typeof value === 'function' ? value(prev[key]) : value }));
  }, []);

  const contextValue = useMemo(() => ({ data, updateData, showToast, currentDate, setCurrentDate }), [data, updateData, showToast, currentDate, setCurrentDate]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div 
              key={t.id} 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 text-sm font-bold text-white
              ${t.type === 'error' ? 'bg-red-500' : t.type === 'success' ? 'bg-emerald-500' : 'bg-slate-800'}`}>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-800 p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
          <p className="mb-4 text-slate-600">アプリケーションで予期せぬエラーが発生しました。</p>
          <pre className="bg-slate-200 p-4 rounded-lg text-xs overflow-auto max-w-2xl w-full mb-6">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            ページを再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const GUIDE_CONTENT: Record<string, { title: string, steps: { title: string, description: string }[] }> = {
  settings: {
    title: '設定ガイド',
    steps: [
      { title: '基本情報の設定', description: '学校名、学年、組、担任名を設定します。' },
      { title: '教科と目標時数', description: '学年に応じた標準時数が設定されています。必要に応じてカスタマイズしてください。' },
      { title: '固定時間割', description: '毎週決まった時間割（ベース）を登録しておくと、週案作成時に一括入力できて便利です。' },
      { title: 'AI・システム設定', description: 'AI機能を利用する場合は、Gemini APIキーを設定してください。' }
    ]
  },
  plan: {
    title: '週案ガイド',
    steps: [
      { title: '週案の作成', description: '「編集モード」ボタンを押して、各コマの教科や単元を入力します。' },
      { title: 'AI単元入力', description: '「AI単元入力」ボタンを押すと、単元マスターから自動で学習内容を埋めることができます。' },
      { title: '固定時間割の反映', description: '「固定時間割」ボタンを押すと、設定タブで登録したベース時間割が一括で反映されます。' },
      { title: 'ショートカット', description: '「?」キーを押すと、便利なキーボードショートカット一覧を確認できます。' }
    ]
  },
  task: {
    title: 'タスクガイド',
    steps: [
      { title: 'タスクの管理', description: '「未着手」「進行中」「完了」のステータスでタスクを管理できます。' },
      { title: 'AIタスク抽出', description: '「AIタスク抽出コンソール」を開き、メモやPDFを解析して、必要なタスクを自動で洗い出すことができます。' },
      { title: 'ドラッグ＆ドロップ', description: 'タスクをドラッグして、ステータスを簡単に変更できます。' }
    ]
  },
  unit: {
    title: '単元マスターガイド',
    steps: [
      { title: '単元の登録', description: '教科ごとに単元名と配当時間を登録します。' },
      { title: 'AI単元生成', description: '「AI単元生成」ボタンを使うと、教科書名や学年を入力するだけで、AIが単元計画を自動作成します。' },
      { title: '進捗管理', description: '週案で入力された時数が自動集計され、進捗状況（消化時数／配当時数）が一目でわかります。' }
    ]
  },
  newsletter: {
    title: '学級通信ガイド',
    steps: [
      { title: '通信の作成', description: '「＋ 新規作成」ボタンから、新しい学級通信を作成できます。' },
      { title: 'ブロックエディタ', description: '「/」キーを押すとコマンドメニューが開き、見出しや画像、週案ブロックなどを挿入できます。' },
      { title: 'AI記事作成', description: '「AI記事作成」ボタンを使うと、箇条書きのメモから丁寧な文章を自動生成できます。' },
      { title: '印刷', description: '「印刷」ボタンを押すと、A4サイズできれいに印刷できます。' }
    ]
  },
  hours: {
    title: '時数管理ガイド',
    steps: [
      { title: '時数の確認', description: '週案に入力された教科ごとの時数が自動で集計されます。' },
      { title: '目標との比較', description: '設定タブで登録した目標時数と、現在の消化時数を比較できます。' },
      { title: '進捗の把握', description: 'グラフや表を使って、各教科の進捗状況を視覚的に確認できます。' }
    ]
  }
};

function GuideModal({ isOpen, onClose, viewId }: { isOpen: boolean, onClose: () => void, viewId: string }) {
  if (!isOpen) return null;
  const content = GUIDE_CONTENT[viewId];
  if (!content) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 border-b pb-3">
          <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-800">
            <HelpCircle className="w-6 h-6 text-indigo-500"/> {content.title}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {content.steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center shrink-0 text-sm">{i + 1}</div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">{step.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-right pt-4 border-t border-slate-100">
          <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
            はじめる
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. メインアプリシェル
// ==========================================
function MainApp() {
  const { data } = useContext(AppContext as any);
  const [currentView, setCurrentView] = useState(() => {
    if (!data.settings || !data.settings.onboarding || !data.settings.onboarding.settings) {
      return 'settings';
    }
    return 'plan';
  });

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
    if (!document.getElementById('zen-maru-font')) {
      const link = document.createElement('link');
      link.id = 'zen-maru-font';
      link.href = 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    document.body.style.fontFamily = "'Zen Maru Gothic', sans-serif";
    document.body.className = "bg-amber-50/40 text-slate-700 m-0 p-0";
  }, []);

  const navItems = [
    { id: 'plan', label: '週案', icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'task', label: 'タスク', icon: <CheckSquare className="w-5 h-5" /> },
    { id: 'unit', label: '単元マスタ', icon: <BookMarked className="w-5 h-5" /> },
    { id: 'newsletter', label: '学級通信', icon: <Newspaper className="w-5 h-5" /> },
    { id: 'hours', label: '時数', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'settings', label: '設定', icon: <Settings className="w-5 h-5" /> }
  ];

  return (
    <div className="flex flex-col h-screen print:h-auto w-full overflow-hidden print:overflow-visible">
      <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        @media print {
          body { background: white !important; }
          .print-area { padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
          @page { margin: 10mm; size: A4 portrait; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; display: block; }
      `}</style>

      <header className="print:hidden flex-none bg-white border-b-4 border-amber-500 px-4 md:px-6 py-2 flex flex-col md:flex-row md:justify-between md:items-center gap-3 shadow-sm z-20">
        <div className="flex items-center gap-2">
          <BookOpen className="text-amber-500 w-7 h-7" />
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">School Plan Note</h1>
            <p className="text-[0.65rem] text-slate-500 font-bold tracking-wider">PREMIUM EDITION</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-hide w-full md:w-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setCurrentView(item.id)} className={`px-3 py-1.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap ${currentView === item.id ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-amber-50'}`}>
              {item.icon} <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-hidden print:overflow-visible relative bg-slate-50">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full absolute inset-0 print:relative print:h-auto print:inset-auto"
          >
            {currentView === 'plan' && <PlanView />}
            {currentView === 'task' && <TaskView />}
            {currentView === 'unit' && <UnitMasterView />}
            {currentView === 'newsletter' && <NewsletterView />}
            {currentView === 'hours' && <HoursView />}
            {currentView === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainApp />
      </AppProvider>
    </ErrorBoundary>
  );
}

// ==========================================
// ユーティリティ関数
// ==========================================
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0,0,0,0);
  return date;
};
const formatDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

// ==========================================
// 📅 1. 週案ビュー (PlanView)
// ==========================================
function PlanView() {
  const { data, updateData, showToast, currentDate, setCurrentDate } = useContext(AppContext as any);
  const [isEdit, setIsEdit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showGuide, setShowGuide] = useState(() => !data.settings.onboarding?.plan);

  const closeGuide = () => {
    setShowGuide(false);
    updateData('settings', { ...data.settings, onboarding: { ...data.settings.onboarding, plan: true } });
  };
  
  const mondayDate = getMonday(currentDate);
  const mondayStr = formatDate(mondayDate);
  
  const generateInitialWeek = () => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    return { date: formatDate(d), dayLabel: ['月','火','水','木','金','土','日'][i], periods: {} };
  });

  const [editData, setEditData] = useState(data.weeklyPlans[mondayStr] || generateInitialWeek());
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [clipboard, setClipboard] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null); 
  const editBufferRef = useRef(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingEvents, setIsGeneratingEvents] = useState(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!data.settings.geminiApiKey) {
      showToast('設定タブでGemini APIキーを設定してください', 'error');
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      return;
    }

    setIsGeneratingEvents(true);
    showToast('PDFを解析しています...', 'info');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const ai = new GoogleGenAI({ apiKey: data.settings.geminiApiKey });
          const modelName = data.settings.geminiModelName || 'gemini-2.5-flash';

          const prompt = `あなたは有能な教務主任・業務アシスタントAIです。
提供されたPDFファイルは、学校の月間行事予定表です。
このPDFから、日付と行事内容を抽出し、JSON配列形式で出力してください。
学校によって様式は異なりますが、一般的にカレンダー形式やリスト形式、表形式で日付と行事が記載されています。
抽出する際は、以下の点に注意してください。
- 日付は "YYYY/MM/DD" の形式に変換してください。年が明記されていない場合は、現在の年（${new Date().getFullYear()}年）または前後の文脈から推測してください。
- 行事内容は、簡潔にまとめてください。
- 授業変更、短縮日課、委員会、クラブ活動、集会などの情報も重要な行事として含めてください。
- 表形式の場合、「行事」「備考」「日課」などの列から総合的に判断して行事内容を抽出してください。
- 休日や何も行事がない日は出力に含めないでください。`;

          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                parts: [
                  { inlineData: { mimeType: 'application/pdf', data: base64Data } },
                  { text: prompt }
                ]
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: GenAIType.ARRAY,
                items: {
                  type: GenAIType.OBJECT,
                  properties: {
                    date: { type: GenAIType.STRING, description: "日付 (YYYY/MM/DD)" },
                    event: { type: GenAIType.STRING, description: "行事内容" }
                  },
                  required: ["date", "event"]
                }
              }
            }
          });

          const resultText = response.text;
          if (!resultText) throw new Error('AIからの応答が空でした');

          const events = JSON.parse(resultText);
          
          const newWeeklyPlans = { ...data.weeklyPlans };
          let updatedCount = 0;

          events.forEach((ev: any) => {
            if (!ev.date || !ev.event) return;
            const [y, m, d] = ev.date.split('/').map(Number);
            if (!y || !m || !d) return;
            
            const evDate = new Date(y, m - 1, d);
            const evMonday = getMonday(evDate);
            const evMondayStr = formatDate(evMonday);
            
            if (!newWeeklyPlans[evMondayStr]) {
              newWeeklyPlans[evMondayStr] = Array.from({ length: 7 }, (_, i) => {
                const dTemp = new Date(evMonday);
                dTemp.setDate(dTemp.getDate() + i);
                return { date: formatDate(dTemp), dayLabel: ['月','火','水','木','金','土','日'][i], periods: {} };
              });
            }
            
            const dayIndex = newWeeklyPlans[evMondayStr].findIndex((day: any) => day.date === ev.date);
            if (dayIndex !== -1) {
              const existingEvent = newWeeklyPlans[evMondayStr][dayIndex].event || '';
              if (!existingEvent.includes(ev.event)) {
                newWeeklyPlans[evMondayStr][dayIndex].event = existingEvent ? `${existingEvent} / ${ev.event}` : ev.event;
                updatedCount++;
              }
            }
          });

          updateData('weeklyPlans', newWeeklyPlans);
          
          const freshData = newWeeklyPlans[mondayStr] || generateInitialWeek();
          if(freshData.length === 5) {
            const d6 = new Date(mondayDate); d6.setDate(d6.getDate() + 5);
            const d7 = new Date(mondayDate); d7.setDate(d7.getDate() + 6);
            freshData.push({ date: formatDate(d6), dayLabel: '土', periods: {} });
            freshData.push({ date: formatDate(d7), dayLabel: '日', periods: {} });
          }
          setEditData(freshData);

          showToast(`${updatedCount}件の行事予定を登録しました`, 'success');
        } catch (error: any) {
          console.error('PDF parsing error:', error);
          showToast(`PDFの解析に失敗しました: ${error.message || '不明なエラー'}`, 'error');
        } finally {
          setIsGeneratingEvents(false);
          if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('File reading error:', error);
      showToast(`ファイルの読み込みに失敗しました: ${error.message || '不明なエラー'}`, 'error');
      setIsGeneratingEvents(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const freshData = data.weeklyPlans[mondayStr] || generateInitialWeek();
    if(freshData.length === 5) {
      const d6 = new Date(mondayDate); d6.setDate(d6.getDate() + 5);
      const d7 = new Date(mondayDate); d7.setDate(d7.getDate() + 6);
      freshData.push({ date: formatDate(d6), dayLabel: '土', periods: {} });
      freshData.push({ date: formatDate(d7), dayLabel: '日', periods: {} });
    }
    setEditData(freshData);
    setIsEdit(false);
    setPast([]);
    setFuture([]);
    setSelectedCell(null);
  }, [mondayStr, data.weeklyPlans]);

  const pushState = (oldState) => {
    setPast(p => [...p, oldState].slice(-20));
    setFuture([]);
  };

  const handleCellFocus = () => { editBufferRef.current = JSON.stringify(editData); };
  const handleCellBlur = () => {
    if (editBufferRef.current) {
      const currentStr = JSON.stringify(editData);
      if (currentStr !== editBufferRef.current) pushState(JSON.parse(editBufferRef.current));
    }
    editBufferRef.current = null;
  };

  const handleSave = () => {
    updateData('weeklyPlans', prev => ({ ...prev, [mondayStr]: editData }));
    setIsEdit(false);
    showToast('週案を保存しました', 'success');
  };

  const updateCell = (dayIdx, rowKey, valKey, value) => {
    const newDays = JSON.parse(JSON.stringify(editData));
    if (valKey) {
      if (!newDays[dayIdx].periods[rowKey]) newDays[dayIdx].periods[rowKey] = { subject:'', unit:'', content:'' };
      newDays[dayIdx].periods[rowKey][valKey] = value;
    } else {
      newDays[dayIdx][rowKey] = value;
    }
    setEditData(newDays);
  };

  const hasWeekendData = editData.slice(5, 7).some(day => {
    if (day.event || day.morning || day.afterschool || day.homework || day.items) return true;
    if (day.periods && Object.values(day.periods).some((p: any) => p.subject || p.unit || p.content)) return true;
    return false;
  });
  const displayDaysCount = (!isEdit && !hasWeekendData) ? 5 : 7;
  const displayDays = editData.slice(0, displayDaysCount);

  const uniqueSubjects = Array.from(new Set((data.unitMaster || []).map((u: any) => u.subject)));
  const subjectsWithUnits = (data.unitMaster || []).reduce((acc: any, u: any) => {
    if (!acc[u.subject]) acc[u.subject] = new Set();
    if (u.unitName) acc[u.subject].add(u.unitName);
    return acc;
  }, {});
  const unitsWithActivities = (data.unitMaster || []).reduce((acc: any, u: any) => {
    if (!acc[u.unitName]) acc[u.unitName] = new Set();
    if (u.activity) acc[u.unitName].add(u.activity);
    return acc;
  }, {});

  const dEnd = new Date(mondayDate); dEnd.setDate(dEnd.getDate() + 6);
  const endStr = formatDate(dEnd).replace(/\//g, '-');
  const startStr = mondayStr.replace(/\//g, '-');
  
  const weekTasks = data.tasks.filter(t => {
    if (t.status === '完了') return t.dueDate >= startStr && t.dueDate <= endStr;
    return !t.dueDate || t.dueDate <= endStr;
  }).sort((a,b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));

  const toggleTask = (id) => { updateData('tasks', p => p.map(t => t.id === id ? { ...t, status: t.status === '完了' ? '未着手' : '完了' } : t)); };

  const [draggedItem, setDraggedItem] = useState<{dayIdx: number, pKey: string} | null>(null); 
  const [dragOverItem, setDragOverItem] = useState<{dayIdx: number, pKey: string} | null>(null);

  const handleDragStart = (dayIdx: number, pKey: string) => { if(isEdit) setDraggedItem({ dayIdx, pKey }); };
  const handleDragOver = (e: React.DragEvent, dayIdx: number, pKey: string) => {
    e.preventDefault();
    if (isEdit && draggedItem && (draggedItem.dayIdx !== dayIdx || draggedItem.pKey !== pKey)) {
      setDragOverItem({ dayIdx, pKey });
    }
  };
  const handleDragLeave = () => { setDragOverItem(null); };
  const handleDrop = (targetDayIdx: number, targetPKey: string) => {
    setDragOverItem(null);
    if (!draggedItem || !isEdit) return;
    pushState(JSON.parse(JSON.stringify(editData))); 
    const newDays = JSON.parse(JSON.stringify(editData));
    const srcCell = { ...(newDays[draggedItem.dayIdx].periods[draggedItem.pKey] || {}) };
    const tgtCell = { ...(newDays[targetDayIdx].periods[targetPKey] || {}) };
    newDays[targetDayIdx].periods[targetPKey] = srcCell;
    newDays[draggedItem.dayIdx].periods[draggedItem.pKey] = tgtCell;
    setEditData(newDays);
    setDraggedItem(null);
    showToast('コマを入れ替えました', 'success');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;
      if (e.key === 'Escape') {
        if (showHelp) { setShowHelp(false); return; }
        if (isInput) { e.target.blur(); return; }
        if (isEdit) { setEditData(data.weeklyPlans[mondayStr]||generateInitialWeek()); setIsEdit(false); return; }
      }
      if ((e.key === '?' || e.key === '/') && !isInput) { e.preventDefault(); setShowHelp(p=>!p); return; }
      if ((e.key === 'e' || e.key === 'E') && !isInput) { e.preventDefault(); setIsEdit(p=>!p); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (isEdit) handleSave(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if(!isInput && isEdit) {
          e.preventDefault();
          if (e.shiftKey) {
            if(future.length > 0) {
              const next = future[0];
              setPast(p => [...p, editData]);
              setFuture(f => f.slice(1));
              setEditData(next);
              showToast('やり直しました');
            }
          } else {
            if(past.length > 0) {
              const prev = past[past.length - 1];
              setFuture(f => [editData, ...f]);
              setPast(p => p.slice(0, -1));
              setEditData(prev);
              showToast('元に戻しました');
            }
          }
        }
        return;
      }
      if (!isEdit && !showHelp && !isInput) {
        if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          let c = selectedCell ? selectedCell.c : 0;
          let r = selectedCell ? selectedCell.r : 0;
          if (e.key === 'ArrowRight') c = Math.min(c + 1, displayDaysCount - 1);
          if (e.key === 'ArrowLeft') c = Math.max(c - 1, 0);
          if (e.key === 'ArrowDown') r = Math.min(r + 1, data.settings.timetableRows.length - 1);
          if (e.key === 'ArrowUp') r = Math.max(r - 1, 0);
          setSelectedCell({ c, r });
        }
        if (e.key === 'Enter' && selectedCell) { e.preventDefault(); setIsEdit(true); }
      }
      if (!isInput && selectedCell && isEdit) {
        const rowDef = data.settings.timetableRows[selectedCell.r];
        const cellData = editData[selectedCell.c];
        const isMulti = rowDef.type === 'multi';

        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          setClipboard({ isMulti, data: isMulti ? cellData.periods?.[rowDef.key] : cellData[rowDef.key] });
          showToast('セルをコピーしました', 'success');
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
          e.preventDefault();
          if (clipboard.isMulti === isMulti) {
            pushState(JSON.parse(JSON.stringify(editData))); 
            const newDays = JSON.parse(JSON.stringify(editData));
            if (isMulti) {
              if(!newDays[selectedCell.c].periods[rowDef.key]) newDays[selectedCell.c].periods[rowDef.key] = {};
              newDays[selectedCell.c].periods[rowDef.key] = clipboard.data;
            } else {
              newDays[selectedCell.c][rowDef.key] = clipboard.data;
            }
            setEditData(newDays);
            showToast('ペーストしました', 'success');
          } else {
            showToast('形式が違うためペーストできません', 'error');
          }
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          pushState(JSON.parse(JSON.stringify(editData))); 
          const newDays = JSON.parse(JSON.stringify(editData));
          if (isMulti) newDays[selectedCell.c].periods[rowDef.key] = {subject:'', unit:'', content:''};
          else newDays[selectedCell.c][rowDef.key] = '';
          setEditData(newDays);
          showToast('セルをクリアしました');
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEdit, showHelp, past, future, editData, selectedCell, clipboard, mondayStr, data.settings.timetableRows, displayDaysCount]);

  const handleAutoFill = () => {
    if(!isEdit) setIsEdit(true);
    pushState(JSON.parse(JSON.stringify(editData)));
    let newDays = JSON.parse(JSON.stringify(editData));
    const umBySubject: Record<string, any[]> = {};
    data.unitMaster.forEach((u: any) => {
      if(!umBySubject[u.subject]) umBySubject[u.subject] = [];
      umBySubject[u.subject].push(u);
    });

    const track: Record<string, number> = {};
    let filledCount = 0;

    // Calculate previous hours for each subject
    Object.values(data.weeklyPlans).forEach((week: any) => {
      week.forEach((day: any) => {
        if (!day.date) return;
        const [y, m, d] = day.date.split('/').map(Number);
        const dayDate = new Date(y, m - 1, d);
        if (dayDate < mondayDate) {
          if(day.periods) {
            Object.values(day.periods).forEach((p: any) => {
              if(p && p.subject && p.content) { // Only count if content is filled, meaning it was actually taught
                const parsed = extractHours(p.subject);
                parsed.forEach(({ subject, hours }: any) => {
                  if (!track[subject]) track[subject] = 0;
                  track[subject] += hours;
                });
              }
            });
          }
        }
      });
    });

    newDays.forEach((day: any) => {
      if(!day.periods) return;
      Object.keys(day.periods).forEach(k => {
        const p = day.periods[k];
        if (p.subject && !p.content) {
          const sName = p.subject.replace(/[\d/.\s　]/g, ''); 
          if(!track[sName]) track[sName] = 0;
          const list = umBySubject[sName];
          const idx = Math.floor(track[sName]);
          if(list && list.length > idx) {
            p.unit = list[idx].unitName;
            p.content = list[idx].activity;
            const parsed = extractHours(p.subject);
            const thisHours = parsed.find((x: any) => x.subject === sName)?.hours || 1;
            track[sName] += thisHours;
            filledCount++;
          }
        }
      });
    });

    if (filledCount > 0) {
      setEditData(newDays);
      showToast(`${filledCount}件の学習内容を自動入力しました`, 'success');
    } else {
      showToast('自動入力できる空欄がありませんでした', 'info');
    }
  };

  const applyBaseTimetable = () => {
    if(!data.settings.baseTimetable) { showToast('設定タブで固定時間割を登録してください', 'error'); return; }
    if(window.confirm('現在の週に固定時間割を上書きしますか？')) {
      if(!isEdit) setIsEdit(true);
      pushState(JSON.parse(JSON.stringify(editData)));
      const newDays = JSON.parse(JSON.stringify(editData));
      data.settings.baseTimetable.forEach((baseDay: any, i: number) => {
        if(i < 5) {
          newDays[i].periods = JSON.parse(JSON.stringify(baseDay.periods || {}));
          if (baseDay.morning !== undefined) newDays[i].morning = baseDay.morning;
        }
      });
      setEditData(newDays);
      showToast('固定時間割を反映しました', 'success');
    }
  };

  const copyFromPreviousWeek = () => {
    const prevMonday = new Date(mondayDate);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prevMondayStr = formatDate(prevMonday);
    const prevWeekData = data.weeklyPlans[prevMondayStr];

    if (!prevWeekData) {
      showToast('前週のデータがありません', 'error');
      return;
    }

    if (window.confirm('現在の週に前週の予定を上書きしますか？')) {
      if (!isEdit) setIsEdit(true);
      pushState(JSON.parse(JSON.stringify(editData)));
      const newDays = JSON.parse(JSON.stringify(editData));
      prevWeekData.forEach((prevDay: any, i: number) => {
        if (newDays[i]) {
          newDays[i].periods = JSON.parse(JSON.stringify(prevDay.periods || {}));
          if (prevDay.morning !== undefined) newDays[i].morning = prevDay.morning;
        }
      });
      setEditData(newDays);
      showToast('前週の予定を反映しました', 'success');
    }
  };

  const [contextMenu, setContextMenu] = useState(null);
  const handleContextMenu = (e, dayIdx, rowKey, pKey) => {
    if (!isEdit) return;
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, dayIdx, rowKey, pKey });
    setSelectedCell({ c: dayIdx, r: data.settings.timetableRows.findIndex(r => r.key === rowKey) });
  };
  const execContextAction = (action) => {
    if (!contextMenu) return;
    pushState(JSON.parse(JSON.stringify(editData)));
    const { dayIdx, rowKey, pKey } = contextMenu;
    const newDays = [...editData];

    if (action === 'clear') {
      if (pKey) newDays[dayIdx].periods[pKey] = { subject:'', unit:'', content:'' };
      else newDays[dayIdx][rowKey] = '';
      showToast('セルをクリアしました');
    } else if (action === 'clearDay') {
      newDays[dayIdx].periods = {};
      showToast(`${newDays[dayIdx].dayLabel}曜の全コマをクリアしました`);
    } else if (action === 'clearPeriod') {
      newDays.forEach(d => { if(d.periods) d.periods[pKey] = { subject:'', unit:'', content:'' }; });
      showToast(`この校時を全曜日クリアしました`);
    }
    setEditData(newDays);
    setContextMenu(null);
  };

  const handleDateChange = (e) => {
    if(e.target.value) {
      if(isEdit) { showToast('編集モード中は移動できません','error'); return; }
      setCurrentDate(new Date(e.target.value));
    }
  };

  // --- 時数計算ロジック（印刷用） ---
  const targetSunday = new Date(mondayDate);
  targetSunday.setDate(targetSunday.getDate() + 6);
  targetSunday.setHours(23, 59, 59, 999);

  const currentWeekCounts: Record<string, number> = {};
  const cumulativeCounts: Record<string, number> = {};

  data.settings.subjects.forEach((sub: any) => {
    currentWeekCounts[sub.name] = 0;
    cumulativeCounts[sub.name] = 0;
  });

  Object.values(data.weeklyPlans).forEach((week: any) => {
    week.forEach((day: any) => {
      if (!day.date) return;
      const [y, m, d] = day.date.split('/').map(Number);
      const dayDate = new Date(y, m - 1, d);
      
      const isCurrentWeek = dayDate >= mondayDate && dayDate <= targetSunday;
      const isUpToTarget = dayDate <= targetSunday;

      const addHours = (subjectStr: string) => {
        const parsed = extractHours(subjectStr);
        parsed.forEach(({ subject, hours }: any) => {
          if (cumulativeCounts[subject] === undefined) cumulativeCounts[subject] = 0;
          if (currentWeekCounts[subject] === undefined) currentWeekCounts[subject] = 0;
          
          if (isUpToTarget) cumulativeCounts[subject] += hours;
          if (isCurrentWeek) currentWeekCounts[subject] += hours;
        });
      };

      if(day.periods) {
        Object.values(day.periods).forEach((p: any) => {
          if(p && p.subject) addHours(p.subject);
        });
      }
    });
  });

  const subjectsList = data.settings.subjects || [];
  const leftSubjects = subjectsList.slice(0, 10);
  const rightSubjects = subjectsList.slice(10);
  const rightRows = [...rightSubjects];
  while (rightRows.length < 10) {
    rightRows.push(null);
  }

  const renderPrintTable = (days: any[]) => (
    <table className="w-full border-collapse text-[11px] select-none border-2 border-slate-800">
      <thead>
        <tr>
          <th className="w-16 border border-slate-800 p-1 font-normal">日付<br/>曜日</th>
          {days.map((day, i) => (
            <th key={i} className={`border border-slate-800 p-1 text-center font-normal ${day.dayLabel === '土' ? 'bg-blue-50' : day.dayLabel === '日' ? 'bg-red-50' : ''}`}>
              {day.date.slice(5)}<br/>{day.dayLabel}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.settings.timetableRows.map((rowDef: any) => (
          <tr key={rowDef.key}>
            <td className={`border border-slate-800 p-1 text-center font-bold ${rowDef.type === 'break' ? 'bg-orange-50' : ''}`}>
              {rowDef.label}
            </td>
            {days.map((day, i) => {
              const isMulti = rowDef.type === 'multi';
              const cellData = isMulti ? (day.periods?.[rowDef.key] || {}) : (day[rowDef.key] || '');
              const content = isMulti ? (
                <div className="flex flex-col h-full">
                  <div className="font-bold text-slate-800 leading-tight">{cellData.subject || ''}</div>
                  <div className="text-slate-600 text-[9px] leading-tight mt-0.5 whitespace-pre-wrap">{cellData.unit || ''}</div>
                </div>
              ) : (
                <div className="text-slate-700 whitespace-pre-wrap leading-tight">{cellData}</div>
              );
              return (
                <td key={i} className={`border border-slate-800 p-1 align-top ${rowDef.type === 'break' ? 'bg-orange-50' : ''}`}>
                  {content}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderHoursTable = (subjects: any[]) => (
    <table className="w-full border-collapse text-[9px] text-center border-2 border-slate-800">
      <thead>
        <tr>
          <th className="border border-slate-800 p-1 font-normal bg-slate-50"></th>
          <th className="border border-slate-800 p-1 font-normal bg-slate-50 w-10">週時数</th>
          <th className="border border-slate-800 p-1 font-normal bg-slate-50 w-10">累計</th>
          <th className="border border-slate-800 p-1 font-normal bg-slate-50 w-12">年間進捗</th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((sub, i) => {
          if (!sub) {
            return (
              <tr key={i}>
                <td className="border border-slate-800 p-1 h-[18px] bg-green-50/30"></td>
                <td className="border border-slate-800 p-1 h-[18px]"></td>
                <td className="border border-slate-800 p-1 h-[18px]"></td>
                <td className="border border-slate-800 p-1 h-[18px]"></td>
              </tr>
            );
          }
          const weekHours = currentWeekCounts[sub.name] || 0;
          const cumulative = cumulativeCounts[sub.name] || 0;
          const target = sub.target || 0;
          const progress = target > 0 ? Math.round((cumulative / target) * 100) : 0;
          return (
            <tr key={i}>
              <td className="border border-slate-800 p-1 bg-green-50/30 text-left pl-2">{sub.name}</td>
              <td className="border border-slate-800 p-1">{weekHours}</td>
              <td className="border border-slate-800 p-1">{cumulative}</td>
              <td className="border border-slate-800 p-1">{progress}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="h-full print:h-auto flex flex-col bg-slate-50 relative" onClick={() => setContextMenu(null)}>
      <div className="print:hidden flex-none p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-2 py-1.5 border border-slate-200">
          <button onClick={() => !isEdit && setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))} className="p-1 hover:bg-white rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-3 py-1 shadow-sm hover:border-amber-400 transition-colors cursor-pointer relative overflow-hidden">
            <CalendarDays className="w-4 h-4 text-amber-600 pointer-events-none" />
            <input type="date" value={mondayStr.replace(/\//g, '-')} onChange={handleDateChange} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer border-none pl-1 w-[125px]" />
          </div>
          <button onClick={() => !isEdit && setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))} className="p-1 hover:bg-white rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          <button onClick={() => !isEdit && setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold text-slate-500 hover:bg-white rounded-md ml-1 border border-slate-300 shadow-sm">今日</button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {isEdit ? (
            <>
              <div className="flex gap-1 border-r border-slate-300 pr-2 mr-1">
                <button onClick={()=>setEditData(past[past.length-1])} disabled={past.length===0} className="p-2 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"><Undo className="w-4 h-4"/></button>
                <button onClick={()=>setEditData(future[0])} disabled={future.length===0} className="p-2 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"><Redo className="w-4 h-4"/></button>
              </div>
              <button onClick={applyBaseTimetable} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-amber-50 hover:text-amber-600 transition-all flex items-center gap-1 shadow-sm"><CalendarClock className="w-4 h-4" /> 固定時間割</button>
              <button onClick={copyFromPreviousWeek} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center gap-1 shadow-sm"><Copy className="w-4 h-4" /> 前週からコピー</button>
              <button onClick={handleAutoFill} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-xs hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-1 shadow-sm"><Wand2 className="w-4 h-4" /> AI単元入力</button>
              <button onClick={() => { setEditData(data.weeklyPlans[mondayStr]||generateInitialWeek()); setIsEdit(false); setPast([]); setFuture([]); }} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-300 transition-all ml-2">キャンセル</button>
              <button onClick={handleSave} className="px-5 py-2 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-all flex items-center gap-2 shadow-sm"><Save className="w-4 h-4" /> 保存</button>
            </>
          ) : (
            <>
              <button onClick={() => setShowGuide(true)} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"><Info className="w-5 h-5"/></button>
              <button onClick={() => setShowHelp(true)} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"><HelpCircle className="w-5 h-5"/></button>
              <button onClick={() => window.print()} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><Printer className="w-4 h-4" /> 印刷</button>
              <input type="file" accept="application/pdf" ref={pdfInputRef} onChange={handlePdfUpload} className="hidden" />
              <button onClick={() => pdfInputRef.current?.click()} disabled={isGeneratingEvents} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-emerald-600 font-bold text-sm hover:bg-emerald-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50">
                {isGeneratingEvents ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span className="hidden md:inline">{isGeneratingEvents ? '解析中...' : '行事PDF読込'}</span>
              </button>
              <button onClick={() => setIsEdit(true)} className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-900 transition-all flex items-center gap-2 shadow-sm"><Edit className="w-4 h-4" /> 編集モード</button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden print:overflow-visible print:block">
        {/* 画面表示用 */}
        <div className="flex-1 overflow-auto p-4 md:p-6 print:hidden">
          <div className="min-w-[800px] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ring-1 ring-slate-100">
            <table className="w-full border-collapse text-sm select-none">
              <thead>
                <tr>
                  <th className="w-16 bg-amber-50 border-b border-r border-amber-200 p-2"></th>
                  {displayDays.map((day, i) => (
                    <th key={i} className={`border-b border-r border-slate-200 p-2 text-center font-bold ${day.date === formatDate(new Date()) ? 'bg-amber-100 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>
                      {day.dayLabel}<br/><span className="text-[0.7rem] font-normal opacity-70">{day.date.slice(5)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.settings.timetableRows.map((rowDef, rIdx) => (
                  <tr key={rowDef.key}>
                    <td className="bg-amber-50 border-b border-r border-amber-100 p-1 text-center font-bold text-amber-800 text-[0.7rem]">
                      {rowDef.label}
                    </td>
                    {displayDays.map((day, cIdx) => {
                      const isMulti = rowDef.type === 'multi';
                      const cellData = isMulti ? (day.periods?.[rowDef.key] || {}) : (day[rowDef.key] || '');
                      const isSelected = selectedCell && selectedCell.c === cIdx && selectedCell.r === rIdx;
                      
                      return (
                        <td 
                          key={cIdx} 
                          onClick={() => { if(!isEdit) setSelectedCell({c: cIdx, r: rIdx}); }}
                          onDoubleClick={() => { if(!isEdit) setIsEdit(true); setSelectedCell({c: cIdx, r: rIdx}); }}
                          onContextMenu={(e) => handleContextMenu(e, cIdx, rowDef.key, isMulti ? rowDef.key : null)}
                          className={`border-b border-r border-slate-200 align-top transition-colors relative 
                            ${isEdit ? 'hover:bg-amber-50/50 cursor-text' : 'cursor-pointer hover:bg-slate-50'}
                            ${isSelected && !isEdit ? 'ring-2 ring-inset ring-amber-400 bg-amber-50/30' : ''}
                            ${draggedItem?.dayIdx === cIdx && draggedItem?.pKey === rowDef.key ? 'opacity-30 bg-slate-100' : ''}
                            ${dragOverItem?.dayIdx === cIdx && dragOverItem?.pKey === rowDef.key ? 'bg-amber-100 ring-2 ring-inset ring-amber-500' : ''}`}
                          draggable={isEdit && isMulti}
                          onDragStart={() => handleDragStart(cIdx, rowDef.key)}
                          onDragOver={(e) => handleDragOver(e, cIdx, rowDef.key)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => { e.preventDefault(); handleDrop(cIdx, rowDef.key); }}
                        >
                          {isEdit ? (
                            <div className="p-1 flex flex-col gap-1 h-full min-h-[68px]">
                              {isMulti ? (
                                <>
                                  <input list="subjects-list" placeholder="教科" className="w-full bg-slate-100 p-1 text-xs font-bold text-slate-800 rounded outline-none focus:bg-white focus:ring-1 focus:ring-amber-400" value={cellData.subject || ''} onChange={e => updateCell(cIdx, rowDef.key, 'subject', e.target.value)} onFocus={handleCellFocus} onBlur={handleCellBlur} />
                                  <input list={cellData.subject ? `units-list-${cellData.subject}` : undefined} placeholder="単元名" className="w-full bg-transparent p-1 text-[0.7rem] text-slate-500 rounded outline-none focus:bg-white focus:ring-1 focus:ring-amber-400" value={cellData.unit || ''} onChange={e => updateCell(cIdx, rowDef.key, 'unit', e.target.value)} onFocus={handleCellFocus} onBlur={handleCellBlur} />
                                  <textarea placeholder="学習内容" className="w-full bg-transparent p-1 text-xs text-slate-600 rounded outline-none resize-none flex-1 focus:bg-white focus:ring-1 focus:ring-amber-400 min-h-[40px]" value={cellData.content || ''} onChange={e => updateCell(cIdx, rowDef.key, 'content', e.target.value)} onFocus={handleCellFocus} onBlur={handleCellBlur} />
                                </>
                              ) : (
                                <textarea placeholder={rowDef.label} className="w-full bg-transparent p-1 text-xs font-medium rounded outline-none resize-none h-full min-h-[30px] focus:bg-white focus:ring-1 focus:ring-amber-400" value={cellData} onChange={e => updateCell(cIdx, rowDef.key, null, e.target.value)} onFocus={handleCellFocus} onBlur={handleCellBlur} />
                              )}
                            </div>
                          ) : (
                            <div className="p-1.5 h-full min-h-[68px] flex flex-col">
                              {isMulti ? (
                                <>
                                  {cellData.subject && <div className="font-bold text-slate-800 bg-amber-50 border-b border-amber-100 -mx-1.5 -mt-1.5 p-0.5 text-center mb-1 text-[0.75rem]">{cellData.subject}</div>}
                                  {cellData.unit && <div className="text-[0.65rem] text-slate-400 leading-tight mb-1 px-1">{cellData.unit}</div>}
                                  <div className="text-[0.7rem] text-slate-600 whitespace-pre-wrap flex-1 px-1 leading-snug">{cellData.content}</div>
                                </>
                              ) : (
                                <div className={`text-xs whitespace-pre-wrap font-medium ${rowDef.key==='event' ? 'text-red-500 text-center':''}`}>{cellData}</div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 印刷用 */}
        <div className="hidden print:block print-area w-full bg-white text-slate-800">
          {/* 1ページ目：月〜金 */}
          <div className="break-after-page">
            <div className="flex justify-between items-end mb-2 px-2">
              <h2 className="text-xl font-bold text-center flex-1">週間指導計画簿</h2>
              <div className="text-xs font-bold">第　　週</div>
            </div>
            {renderPrintTable(editData.slice(0, 5))}
          </div>

          {/* 2ページ目：土日 ＋ 右側ペイン */}
          <div className="flex gap-4 pt-4">
            {/* 左側：土日テーブル */}
            <div className="w-[40%]">
              {renderPrintTable(editData.slice(5, 7))}
            </div>
            
            {/* 右側：時数、Todo、メモ、検印 */}
            <div className="w-[60%] flex flex-col gap-4">
              {/* 時数表 */}
              <div className="flex gap-2">
                <div className="w-1/2">
                  {renderHoursTable(leftSubjects)}
                </div>
                <div className="w-1/2">
                  {renderHoursTable(rightRows)}
                </div>
              </div>
              
              {/* Todoリスト */}
              <div className="border-2 border-green-800 bg-green-50/30 p-2 rounded">
                <div className="font-bold text-green-800 mb-2 text-[10px]">Todoリスト</div>
                <div className="space-y-1">
                  <div className="h-5 bg-white border border-green-800"></div>
                  <div className="h-5 bg-white border border-green-800"></div>
                  <div className="h-5 bg-white border border-green-800"></div>
                </div>
              </div>

              {/* フリー記述欄 */}
              <div className="flex-1 mt-2 flex flex-col gap-5">
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
                <div className="border-b border-dashed border-slate-300"></div>
              </div>

              {/* 検印欄 */}
              <div className="self-end flex border-2 border-slate-800 mt-2">
                <div className="p-1 border-r-2 border-slate-800 flex items-center justify-center font-bold text-[10px]" style={{ writingMode: 'vertical-rl' }}>検印</div>
                <table className="border-collapse text-[9px] text-center">
                  <thead>
                    <tr>
                      <th className="border-b-2 border-r border-slate-800 p-1 w-12 font-normal">校長</th>
                      <th className="border-b-2 border-r border-slate-800 p-1 w-12 font-normal">副校長</th>
                      <th className="border-b-2 border-slate-800 p-1 w-12 font-normal">担当者</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r border-slate-800 h-12 w-12"></td>
                      <td className="border-r border-slate-800 h-12 w-12"></td>
                      <td className="h-12 w-12"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="print:hidden w-64 lg:w-72 bg-white border-l border-slate-200 flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 shrink-0">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
            <div className="flex items-center gap-2">
              <CheckSquare className="text-amber-600 w-5 h-5" />
              <h2 className="font-bold text-sm text-slate-700">当該週のタスク</h2>
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{weekTasks.filter(t=>t.status!=='完了').length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
            {weekTasks.length === 0 ? (
              <p className="text-xs text-center text-slate-400 mt-10">今週のタスクはありません</p>
            ) : (
              weekTasks.map(t => (
                <div key={t.id} className={`flex items-start gap-2 p-2 rounded-lg border transition-all ${t.status === '完了' ? 'bg-slate-100 border-slate-200 opacity-50' : 'bg-white border-amber-200 shadow-sm'}`}>
                  <input type="checkbox" checked={t.status === '完了'} onChange={() => toggleTask(t.id)} className="mt-0.5 w-4 h-4 cursor-pointer accent-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${t.status === '完了' ? 'line-through text-slate-500' : 'text-slate-800'}`}>{t.content}</p>
                    {t.dueDate && <p className="text-[10px] text-amber-600 mt-0.5">{t.dueDate.replace(/-/g, '/')}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {contextMenu && (
        <div className="absolute bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 min-w-[200px]" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button onClick={() => execContextAction('clear')} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm font-bold flex items-center gap-2"><Trash2 className="w-4 h-4"/> このセルをクリア</button>
          {contextMenu.pKey && (
            <>
              <div className="h-px bg-slate-100 my-1"></div>
              <button onClick={() => execContextAction('clearDay')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm font-bold flex items-center gap-2"><X className="w-4 h-4"/> この日の全コマをクリア</button>
              <button onClick={() => execContextAction('clearPeriod')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm font-bold flex items-center gap-2"><X className="w-4 h-4"/> この校時を全曜日クリア</button>
            </>
          )}
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4 border-b pb-2"><HelpCircle className="w-5 h-5 text-indigo-500"/> ショートカット一覧</h3>
            <table className="w-full text-sm text-left">
              <tbody>
                <tr className="border-b"><th className="py-2 w-24">E</th><td className="py-2 text-slate-600">編集モード切替</td></tr>
                <tr className="border-b"><th className="py-2">Ctrl + S</th><td className="py-2 text-slate-600">保存</td></tr>
                <tr className="border-b"><th className="py-2">Ctrl + Z</th><td className="py-2 text-slate-600">元に戻す (Undo)</td></tr>
                <tr className="border-b"><th className="py-2">Ctrl + Y</th><td className="py-2 text-slate-600">やり直す (Redo)</td></tr>
                <tr className="border-b"><th className="py-2">矢印キー</th><td className="py-2 text-slate-600">セルの選択移動</td></tr>
                <tr className="border-b"><th className="py-2">Enter</th><td className="py-2 text-slate-600">選択セルの編集</td></tr>
                <tr className="border-b"><th className="py-2">Ctrl + C/V</th><td className="py-2 text-slate-600">コピー / ペースト</td></tr>
                <tr className="border-b"><th className="py-2">Del / BS</th><td className="py-2 text-slate-600">セルのクリア</td></tr>
                <tr><th className="py-2">? / Esc</th><td className="py-2 text-slate-600">ヘルプ開閉 / 閉じる</td></tr>
              </tbody>
            </table>
            <div className="mt-4 text-center">
              <button onClick={() => setShowHelp(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm w-full">閉じる</button>
            </div>
          </div>
        </div>
      )}
      <datalist id="subjects-list">
        {uniqueSubjects.map(s => <option key={s as string} value={s as string} />)}
      </datalist>
      {Object.entries(subjectsWithUnits).map(([sub, units]) => (
        <datalist key={sub} id={`units-list-${sub}`}>
          {Array.from(units as Set<string>).map(u => <option key={u} value={u} />)}
        </datalist>
      ))}
      {Object.entries(unitsWithActivities).map(([unit, activities]) => (
        <datalist key={unit} id={`activities-list-${unit}`}>
          {Array.from(activities as Set<string>).map(a => <option key={a} value={a} />)}
        </datalist>
      ))}

      <GuideModal isOpen={showGuide} onClose={closeGuide} viewId="plan" />
    </div>
  );
}

// ==========================================
// 2-3. 他のビュー (TaskView, UnitMasterView, HoursView, SettingsView) は前回と同じため省略せずに記載
// ==========================================

function TaskView() {
  const { data, updateData, showToast } = useContext(AppContext);
  const [showGuide, setShowGuide] = useState(() => !data.settings.onboarding?.task);

  const closeGuide = () => {
    setShowGuide(false);
    updateData('settings', { ...data.settings, onboarding: { ...data.settings.onboarding, task: true } });
  };

  const [inputText, setInputText] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [aiMode, setAiMode] = useState('text');
  const [aiText, setAiText] = useState('');
  const [aiPdfFile, setAiPdfFile] = useState<File | null>(null);
  const [aiStartDate, setAiStartDate] = useState(formatDate(new Date()).replace(/\//g, '-'));
  const [aiEndDate, setAiEndDate] = useState(formatDate(new Date(new Date().setDate(new Date().getDate() + 14))).replace(/\//g, '-'));
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreviewTasks, setAiPreviewTasks] = useState([]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const addTask = (e, text = inputText) => {
    if(e) e.preventDefault();
    if (!text.trim()) return;
    const newTask = { id: Date.now().toString(), content: text, status: '未着手', date: formatDate(new Date()) };
    updateData('tasks', prev => [newTask, ...prev]);
    setInputText('');
    showToast('タスクを追加しました', 'success');
  };

  const toggleTask = (id) => {
    updateData('tasks', prev => prev.map(t => t.id === id ? { ...t, status: t.status === '完了' ? '未着手' : '完了' } : t));
  };

  const handleDragStart = (id: string) => { setDraggedTaskId(id); };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedTaskId && draggedTaskId !== id) {
      setDragOverTaskId(id);
    }
  };
  const handleDragLeave = () => { setDragOverTaskId(null); };
  const handleDrop = (targetId: string) => {
    setDragOverTaskId(null);
    if (!draggedTaskId || draggedTaskId === targetId) return;
    
    updateData('tasks', prev => {
      const newTasks = [...prev];
      const draggedIndex = newTasks.findIndex(t => t.id === draggedTaskId);
      const targetIndex = newTasks.findIndex(t => t.id === targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [draggedItem] = newTasks.splice(draggedIndex, 1);
        newTasks.splice(targetIndex, 0, draggedItem);
      }
      return newTasks;
    });
    setDraggedTaskId(null);
  };

  const callGeminiAPI = async (prompt: string, pdfBase64?: string) => {
    const apiKey = data.settings.geminiApiKey;
    const modelName = data.settings.geminiModelName || 'gemini-2.5-flash';
    if (!apiKey) throw new Error('Gemini APIキーが設定されていません。「設定」タブで登録してください。');
    
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    if (pdfBase64) {
      parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts }],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: GenAIType.ARRAY,
          items: {
            type: GenAIType.OBJECT,
            properties: {
              task: { type: GenAIType.STRING },
              resource: { type: GenAIType.STRING },
              dueDate: { type: GenAIType.STRING },
              source: { type: GenAIType.STRING }
            },
            required: ["task", "resource", "dueDate", "source"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error('AIからの応答が空でした');
    return JSON.parse(resultText);
  };

  const runAiExtraction = async () => {
    setAiPreviewTasks([]);
    setAiLoading(true);
    try {
      let prompt = '';
      let pdfBase64 = undefined;
      
      if (aiMode === 'text') {
        if (!aiText.trim()) throw new Error('解析するテキストを入力してください');
        prompt = `あなたは有能な業務アシスタントAIです。（本日の日付: ${formatDate(new Date())}）\n以下の【テキスト情報】を読み取り、教員が今後行うべき【タスク】を洗い出してください。\n【テキスト情報】\n${aiText}`;
      } else if (aiMode === 'pdf') {
        if (!aiPdfFile) throw new Error('PDFファイルを選択してください');
        
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
        });
        reader.readAsDataURL(aiPdfFile);
        pdfBase64 = await base64Promise;
        
        prompt = `あなたは有能な業務アシスタントAIです。（本日の日付: ${formatDate(new Date())}）\n提供されたPDFファイルを読み取り、教員が今後行うべき【タスク】を洗い出してください。`;
      } else {
        if (!aiStartDate || !aiEndDate) throw new Error('期間を指定してください');
        let scheduleText = '';
        Object.values(data.weeklyPlans).forEach((week: any) => {
          week.forEach((day: any) => {
            const dateStr = day.date.replace(/\//g, '-');
            if (dateStr >= aiStartDate && dateStr <= aiEndDate) {
              let dayText = `\n【${dateStr}】\n`;
              let hasData = false;
              if (day.event) { dayText += `- 行事: ${day.event}\n`; hasData = true; }
              if (day.morning) { dayText += `- 朝学習: ${day.morning}\n`; hasData = true; }
              if (day.periods) {
                Object.keys(day.periods).forEach(k => {
                  const p = day.periods[k];
                  if (p.subject && p.content) { dayText += `- ${k.replace('period', '')}校時 [${p.subject}] 内容: ${p.content}\n`; hasData = true; }
                });
              }
              if (day.afterschool) { dayText += `- 放課後: ${day.afterschool}\n`; hasData = true; }
              if (hasData) scheduleText += dayText;
            }
          });
        });
        if (!scheduleText) throw new Error('指定された期間に予定データがありません');
        prompt = `あなたは有能な小学校教員のサポートAIです。\n以下の【スケジュール情報】から、教員が事前に準備すべき【タスク（準備・連絡など）】を洗い出してください。\n※通常の授業で特別な準備が不要なものは除外してください。\n【スケジュール情報】\n${scheduleText}`;
      }
      const extracted = await callGeminiAPI(prompt, pdfBase64);
      setAiPreviewTasks(extracted || []);
      showToast('AIによる抽出が完了しました', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const saveAiTasks = () => {
    if (aiPreviewTasks.length === 0) return;
    const newTasks = aiPreviewTasks.map(t => ({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), content: t.task, resource: t.resource, dueDate: t.dueDate, source: t.source, status: '未着手' }));
    updateData('tasks', prev => [...newTasks, ...prev]);
    setAiPreviewTasks([]);
    setShowAi(false);
    setAiText('');
    setAiPdfFile(null);
    showToast(`${newTasks.length}件のタスクを追加しました`, 'success');
  };

  const activeTasks = data.tasks.filter(t => t.status !== '完了');
  const completedTasks = data.tasks.filter(t => t.status === '完了');

  return (
    <div className="h-full print:h-auto overflow-auto print:overflow-visible p-4 md:p-8 bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-end gap-2">
          <button onClick={() => setShowGuide(true)} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"><Info className="w-5 h-5"/></button>
          <button onClick={() => { setShowAi(!showAi); setAiPdfFile(null); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors shadow-sm border ${showAi ? 'bg-white border-slate-200 text-slate-500' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}>
            <Sparkles className="w-4 h-4" /> {showAi ? 'AIコンソールを閉じる' : 'AIタスク抽出コンソール'}
          </button>
        </div>

        {showAi && (
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm animate-fade-in">
            <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5"/> AI タスク抽出コンソール</h3>
            <div className="flex gap-4 mb-4 border-b border-emerald-200/50 pb-3 flex-wrap">
              <label className="flex items-center gap-1.5 font-bold text-sm cursor-pointer"><input type="radio" value="text" checked={aiMode === 'text'} onChange={(e) => {setAiMode(e.target.value); setAiPreviewTasks([]); setAiPdfFile(null);}} className="accent-emerald-600 w-4 h-4" />フリーテキスト解析</label>
              <label className="flex items-center gap-1.5 font-bold text-sm cursor-pointer"><input type="radio" value="pdf" checked={aiMode === 'pdf'} onChange={(e) => {setAiMode(e.target.value); setAiPreviewTasks([]);}} className="accent-emerald-600 w-4 h-4" />PDF解析</label>
              <label className="flex items-center gap-1.5 font-bold text-sm cursor-pointer"><input type="radio" value="schedule" checked={aiMode === 'schedule'} onChange={(e) => {setAiMode(e.target.value); setAiPreviewTasks([]); setAiPdfFile(null);}} className="accent-emerald-600 w-4 h-4" />予定解析（週案から逆算）</label>
            </div>
            {aiMode === 'text' ? (
              <textarea value={aiText} onChange={e=>setAiText(e.target.value)} className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-400 h-24 mb-3 resize-none shadow-inner" placeholder="メモをここにペースト..." />
            ) : aiMode === 'pdf' ? (
              <div className="mb-4">
                <input type="file" accept="application/pdf" onChange={(e) => setAiPdfFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-emerald-200 rounded-xl p-2 bg-white" />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm bg-white p-3 rounded-xl border border-emerald-200 shadow-inner w-fit mb-4">
                <span className="font-bold text-slate-600">抽出期間:</span>
                <input type="date" value={aiStartDate} onChange={e=>setAiStartDate(e.target.value)} className="border border-slate-300 rounded px-2 py-1 outline-none"/>
                <span className="text-slate-400">〜</span>
                <input type="date" value={aiEndDate} onChange={e=>setAiEndDate(e.target.value)} className="border border-slate-300 rounded px-2 py-1 outline-none"/>
              </div>
            )}
            <div className="flex justify-end mb-4">
              <button onClick={runAiExtraction} disabled={aiLoading} className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>} {aiLoading ? '解析中...' : '抽出を実行'}
              </button>
            </div>
            {aiPreviewTasks.length > 0 && (
              <div className="bg-white border border-emerald-300 rounded-xl p-4 shadow-sm">
                <p className="text-xs font-bold text-emerald-600 mb-3 flex items-center gap-1"><Sparkles className="w-4 h-4"/> 抽出結果</p>
                <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                  {aiPreviewTasks.map((t, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-sm">
                      <div className="font-bold text-slate-800 mb-1">{t.task}</div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {t.resource && <span><span className="font-bold text-slate-400">準備物:</span> {t.resource}</span>}
                        {t.dueDate && <span><span className="font-bold text-slate-400">期日:</span> {t.dueDate}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAiPreviewTasks([])} className="px-4 py-1.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">キャンセル</button>
                  <button onClick={saveAiTasks} className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg shadow hover:bg-emerald-700 flex items-center gap-1"><Save className="w-4 h-4"/> タスクに追加</button>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={e=>addTask(e)} className="flex gap-2">
          <input value={inputText} onChange={e => setInputText(e.target.value)} placeholder="新しいタスクを入力... (例: 宿題の丸付け)" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400 font-bold shadow-sm" />
          <button type="submit" className="bg-amber-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-amber-600"><Plus className="w-5 h-5" /> 追加</button>
        </form>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">現在のタスク</h3>
          <div className="space-y-2">
            {activeTasks.length === 0 ? <p className="text-center text-slate-400 py-6 text-sm">タスクはありません☕️</p> : 
            <AnimatePresence>
              {activeTasks.map(t => (
                <motion.div 
                  key={t.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  layout
                  draggable
                  onDragStart={() => handleDragStart(t.id)}
                  onDragOver={(e) => handleDragOver(e, t.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(t.id)}
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-amber-50/50 border border-amber-100 rounded-xl group hover:bg-amber-50 transition-colors cursor-grab active:cursor-grabbing
                    ${draggedTaskId === t.id ? 'opacity-30' : ''}
                    ${dragOverTaskId === t.id ? 'border-t-amber-500 border-t-4' : ''}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button onClick={() => toggleTask(t.id)} className="text-slate-300 hover:text-amber-500 shrink-0"><CheckSquare className="w-6 h-6" /></button>
                    <span className="font-bold text-slate-700 truncate">{t.content}</span>
                  </div>
                  <div className="flex items-center gap-3 pl-9 sm:pl-0">
                     {t.resource && <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-[120px]">{t.resource}</span>}
                     {t.dueDate && <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded whitespace-nowrap">{t.dueDate}</span>}
                    <button onClick={() => updateData('tasks', p=>p.filter(x=>x.id!==t.id))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            }
          </div>
        </div>

        {completedTasks.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6">
            <h3 className="font-bold text-slate-500 mb-4 border-b border-slate-100 pb-2">完了したタスク</h3>
            <div className="space-y-2 opacity-60">
              <AnimatePresence>
                {completedTasks.map(t => (
                  <motion.div 
                    key={t.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    layout
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button onClick={() => toggleTask(t.id)} className="text-emerald-500 hover:text-slate-400 shrink-0"><CheckSquare className="w-6 h-6" /></button>
                      <span className="font-bold text-slate-500 line-through truncate">{t.content}</span>
                    </div>
                    <div className="flex items-center gap-3 pl-9 sm:pl-0">
                       {t.resource && <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-[120px]">{t.resource}</span>}
                       {t.dueDate && <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded whitespace-nowrap">{t.dueDate}</span>}
                      <button onClick={() => updateData('tasks', p=>p.filter(x=>x.id!==t.id))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
      <GuideModal isOpen={showGuide} onClose={closeGuide} viewId="task" />
    </div>
  );
}

function UnitMasterView() {
  const { data, updateData, showToast } = useContext(AppContext as any);
  const [showGuide, setShowGuide] = useState(() => !data.settings.onboarding?.unit);

  const closeGuide = () => {
    setShowGuide(false);
    updateData('settings', { ...data.settings, onboarding: { ...data.settings.onboarding, unit: true } });
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [filterSubject, setFilterSubject] = useState('');
  const [filterUnitName, setFilterUnitName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draggedUnitId, setDraggedUnitId] = useState<string | null>(null);
  const [dragOverUnitId, setDragOverUnitId] = useState<string | null>(null);

  const handleDragStart = (id: string) => { setDraggedUnitId(id); };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedUnitId && draggedUnitId !== id) {
      setDragOverUnitId(id);
    }
  };
  const handleDragLeave = () => { setDragOverUnitId(null); };
  const handleDrop = (targetId: string) => {
    setDragOverUnitId(null);
    if (!draggedUnitId || draggedUnitId === targetId) return;
    
    updateData('unitMaster', (prev: any[]) => {
      const newUnits = [...prev];
      const draggedIndex = newUnits.findIndex(u => u.id === draggedUnitId);
      const targetIndex = newUnits.findIndex(u => u.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const [draggedItem] = newUnits.splice(draggedIndex, 1);
      
      // Since we removed an item, the target index might have shifted
      // If the dragged item was before the target item, the target index is now 1 less
      const adjustedTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      
      newUnits.splice(adjustedTargetIndex, 0, draggedItem);
      return newUnits;
    });
    setDraggedUnitId(null);
  };

  const handleAddBelow = (targetId: string) => {
    const targetIndex = (data.unitMaster || []).findIndex((u: any) => u.id === targetId);
    if (targetIndex === -1) return;
    const targetUnit = data.unitMaster[targetIndex];
    
    const newUnit = { 
      id: Date.now().toString(), 
      subject: targetUnit.subject, 
      unitName: targetUnit.unitName, 
      totalHours: targetUnit.totalHours, 
      hourNum: parseInt(targetUnit.hourNum) + 1 || 1, 
      activity: '新しい活動内容' 
    };
    
    updateData('unitMaster', (p: any) => {
      const newArr = [...(p || [])];
      newArr.splice(targetIndex + 1, 0, newUnit);
      return newArr;
    });
    startEdit(newUnit);
  };

  const handleAdd = () => {
    const newUnit = { id: Date.now().toString(), subject: '国語', unitName: '新しい単元', totalHours: 1, hourNum: 1, activity: '活動内容' };
    updateData('unitMaster', (p: any) => [newUnit, ...(p || [])]);
    startEdit(newUnit);
  };
  const startEdit = (item: any) => { setEditingId(item.id); setEditForm(item); };
  const saveEdit = () => { updateData('unitMaster', (p: any) => p.map((u: any) => u.id === editingId ? editForm : u)); setEditingId(null); showToast('単元マスタを更新しました', 'success'); };
  const removeUnit = (id: string) => { if(window.confirm('削除しますか？')) updateData('unitMaster', (p: any) => p.filter((u: any) => u.id !== id)); };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showToast('PDFファイルを選択してください', 'error');
      return;
    }
    if (!data.settings.geminiApiKey) {
      showToast('設定タブでGemini APIキーを設定してください', 'error');
      return;
    }

    setIsGenerating(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Data = (event.target?.result as string).split(',')[1];
          const ai = new GoogleGenAI({ apiKey: data.settings.geminiApiKey });
          const response = await ai.models.generateContent({
            model: data.settings.geminiModelName || 'gemini-2.5-flash',
            contents: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: 'application/pdf'
                }
              },
              "このPDFは教科書の単元指導計画です。このPDFから、単元のリストを抽出してください。各単元について、教科名、単元名、総時数、その時間の時数（何時間目か）、学習活動の内容を抽出してください。同じ単元で複数時間ある場合は、時間ごとに分けて抽出してください。"
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: GenAIType.ARRAY,
                items: {
                  type: GenAIType.OBJECT,
                  properties: {
                    subject: { type: GenAIType.STRING, description: "教科名" },
                    unitName: { type: GenAIType.STRING, description: "単元名" },
                    totalHours: { type: GenAIType.NUMBER, description: "その単元の総時数" },
                    hourNum: { type: GenAIType.NUMBER, description: "その単元における何時間目か" },
                    activity: { type: GenAIType.STRING, description: "学習活動の内容" }
                  },
                  required: ["subject", "unitName", "totalHours", "hourNum", "activity"]
                }
              }
            }
          });
          
          const jsonStr = response.text;
          if (jsonStr) {
            const generatedUnits = JSON.parse(jsonStr);
            const newUnits = generatedUnits.map((u: any) => ({
              ...u,
              id: Date.now().toString() + Math.random().toString(36).substring(7)
            }));
            updateData('unitMaster', (p: any) => [...newUnits, ...(p || [])]);
            showToast(`${newUnits.length}件の単元データを自動生成しました`, 'success');
          }
        } catch (err) {
          console.error(err);
          showToast('AIによる読み込みに失敗しました', 'error');
        } finally {
          setIsGenerating(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      showToast('ファイルの読み込みに失敗しました', 'error');
      setIsGenerating(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredUnits = (data.unitMaster || []).filter((u: any) => {
    const matchSubject = filterSubject === '' || u.subject.includes(filterSubject);
    const matchUnitName = filterUnitName === '' || u.unitName.includes(filterUnitName);
    return matchSubject && matchUnitName;
  });

  const isFiltered = filterSubject !== '' || filterUnitName !== '';

  const uniqueSubjects = Array.from(new Set((data.unitMaster || []).map((u: any) => u.subject)));

  return (
    <div className="h-full print:h-auto overflow-auto print:overflow-visible p-4 md:p-8 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
          <div className="flex items-center gap-2">
            <BookMarked className="text-indigo-600 w-8 h-8" />
            <h2 className="text-2xl font-bold text-slate-800">単元マスタ編集</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowGuide(true)} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"><Info className="w-5 h-5"/></button>
            <input 
              type="file" 
              accept="application/pdf" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isGenerating}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 hover:bg-emerald-700 shadow-sm disabled:opacity-50"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'AI読み込み中...' : 'PDFからAI自動生成'}
            </button>
            <button onClick={handleAdd} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1 hover:bg-indigo-700 shadow-sm"><Plus className="w-4 h-4"/> 行追加</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex gap-4 items-center">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">教科で絞り込み</label>
            <select 
              value={filterSubject} 
              onChange={e => setFilterSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">すべて</option>
              {uniqueSubjects.map((sub: any) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">単元名で絞り込み</label>
            <input 
              type="text" 
              value={filterUnitName} 
              onChange={e => setFilterUnitName(e.target.value)}
              placeholder="単元名を入力..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 border-b border-slate-200 font-bold">教科</th>
                <th className="p-3 border-b border-slate-200 font-bold">単元名</th>
                <th className="p-3 border-b border-slate-200 font-bold w-16 text-center">総時数</th>
                <th className="p-3 border-b border-slate-200 font-bold w-16 text-center">時数</th>
                <th className="p-3 border-b border-slate-200 font-bold">学習活動</th>
                <th className="p-3 border-b border-slate-200 font-bold w-24 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredUnits.length === 0 ? (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <td colSpan={6} className="p-8 text-center text-slate-400">データがありません。</td>
                  </motion.tr>
                ) : (
                  filteredUnits.map((u: any) => (
                    <motion.tr 
                      key={u.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                      layout
                      draggable={!isFiltered && editingId !== u.id}
                      onDragStart={() => handleDragStart(u.id)}
                      onDragOver={(e) => handleDragOver(e, u.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={() => handleDrop(u.id)}
                      className={`hover:bg-slate-50 ${editingId === u.id ? 'bg-indigo-50/30' : ''} ${dragOverUnitId === u.id ? 'border-t-2 border-indigo-500' : ''} ${!isFiltered && editingId !== u.id ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                      {editingId === u.id ? (
                        <>
                          <td className="p-2 border-b"><input className="w-full p-1 border rounded outline-none" value={editForm.subject} onChange={e=>setEditForm({...editForm, subject:e.target.value})} /></td>
                          <td className="p-2 border-b"><input className="w-full p-1 border rounded outline-none" value={editForm.unitName} onChange={e=>setEditForm({...editForm, unitName:e.target.value})} /></td>
                          <td className="p-2 border-b"><input type="number" className="w-full p-1 border rounded text-center outline-none" value={editForm.totalHours} onChange={e=>setEditForm({...editForm, totalHours:e.target.value})} /></td>
                          <td className="p-2 border-b"><input type="number" className="w-full p-1 border rounded text-center outline-none" value={editForm.hourNum} onChange={e=>setEditForm({...editForm, hourNum:e.target.value})} /></td>
                          <td className="p-2 border-b"><input className="w-full p-1 border rounded outline-none" value={editForm.activity} onChange={e=>setEditForm({...editForm, activity:e.target.value})} /></td>
                          <td className="p-2 border-b text-center"><button onClick={saveEdit} className="text-emerald-600 font-bold p-1 hover:bg-emerald-50 rounded">保存</button></td>
                        </>
                      ) : (
                        <>
                          <td className="p-3 border-b font-bold text-slate-700">{u.subject}</td>
                          <td className="p-3 border-b text-slate-600">{u.unitName}</td>
                          <td className="p-3 border-b text-center">{u.totalHours}</td>
                          <td className="p-3 border-b text-center">{u.hourNum}</td>
                          <td className="p-3 border-b text-slate-600">{u.activity}</td>
                          <td className="p-3 border-b text-center space-x-2">
                            <button onClick={()=>startEdit(u)} className="text-slate-400 hover:text-indigo-600"><Edit className="w-4 h-4 inline"/></button>
                            <button onClick={()=>handleAddBelow(u.id)} className="text-slate-400 hover:text-emerald-600" title="この下に行を追加"><Plus className="w-4 h-4 inline"/></button>
                            <button onClick={()=>removeUnit(u.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4 inline"/></button>
                          </td>
                        </>
                      )}
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      <GuideModal isOpen={showGuide} onClose={closeGuide} viewId="unit" />
    </div>
  );
}

// ------------------------------------------
// 📰 4. 学級通信ビュー (NewsletterView) - Notion級ブロックエディタ
// ------------------------------------------
const getTemplates = (settings: any) => [
  {
    name: '🌟 学期はじめの号',
    blocks: [
      { id: 't1', type: 'heading1', content: `${settings.grade}年${settings.classNumber}組 学級通信「あおぞら」 第1号`, align: 'center', color: '#1e293b' },
      { id: 't2', type: 'text', content: '進級おめでとうございます。新しい学年がスタートしました。子どもたちの笑顔がまぶしい季節ですね。', align: 'left' },
      { id: 't3', type: 'callout', content: '【保護者の皆様へ】<br>今年度も教育活動へのご理解とご協力をお願いいたします。', align: 'left' },
      { id: 't4', type: 'columns', columns: [
        { id: 'tc1', type: 'text', content: `<b>■担任紹介</b><br>${settings.grade}年${settings.classNumber}組：${settings.teacherName}` },
        { id: 'tc2', type: 'text', content: '<b>■今月の目標</b><br>「新しい友達をたくさん作ろう」' }
      ], align: 'left' },
    ]
  },
  {
    name: '📝 行事のお知らせ',
    blocks: [
      { id: 't1', type: 'heading1', content: '運動会のお知らせ', align: 'center', color: '#1e293b' },
      { id: 't2', type: 'text', content: 'いよいよ運動会が近づいてきました。子どもたちは毎日練習を頑張っています。', align: 'left' },
      { id: 't3', type: 'bulleted_list', content: '日時：〇月〇日（土） 9:00〜' },
      { id: 't4', type: 'bulleted_list', content: '場所：本校グラウンド' },
      { id: 't5', type: 'bulleted_list', content: '持ち物：水筒、タオル、帽子' },
      { id: 't6', type: 'divider' },
      { id: 't7', type: 'qrcode', url: 'https://forms.google.com/sample' },
      { id: 't8', type: 'text', content: '▲ 観覧の事前アンケートにご回答をお願いします', align: 'center' }
    ]
  },
  {
    name: '✅ 持ち物チェックリスト',
    blocks: [
      { id: 't1', type: 'heading1', content: '明日の持ち物', align: 'center', color: '#1e293b' },
      { id: 't2', type: 'text', content: '明日は校外学習です。以下の持ち物を準備してください。', align: 'left' },
      { id: 't3', type: 'todo', content: 'お弁当', checked: false },
      { id: 't4', type: 'todo', content: '水筒', checked: false },
      { id: 't5', type: 'todo', content: 'しおり', checked: false },
      { id: 't6', type: 'todo', content: '筆記用具', checked: false },
      { id: 't7', type: 'todo', content: '雨具（折りたたみ傘）', checked: false },
      { id: 't8', type: 'callout', content: '※おやつは持たせないでください。' }
    ]
  }
];

// Reactで安全に contentEditable を扱うコンポーネント
const EditableContent = React.forwardRef(({ html, tagName, className, style, onChange, onInput, onKeyDown, placeholder, autoFocus }, ref) => {
  const internalRef = useRef(null);
  const elementRef = ref || internalRef;

  useEffect(() => {
    if (elementRef.current && elementRef.current.innerHTML !== html) {
      if (document.activeElement !== elementRef.current) {
        elementRef.current.innerHTML = html;
      }
    }
  }, [html, elementRef]);

  useEffect(() => {
    if (autoFocus && elementRef.current) {
      elementRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(elementRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [autoFocus, elementRef]);

  return React.createElement(tagName, {
    ref: elementRef,
    className: `outline-none ${className}`,
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    'data-placeholder': placeholder,
    onBlur: (e) => onChange(e.target.innerHTML),
    onInput: (e) => {
      // innerTextだと改行などがブラウザによって異なるため、textContentを使用
      if (onInput) onInput(e, e.target.innerHTML, e.target.textContent);
    },
    onKeyDown: onKeyDown,
  });
});

function NewsletterView() {
  const { data, updateData, showToast } = useContext(AppContext);
  const [showGuide, setShowGuide] = useState(() => !data.settings.onboarding?.newsletter);

  const closeGuide = () => {
    setShowGuide(false);
    updateData('settings', { ...data.settings, onboarding: { ...data.settings.onboarding, newsletter: true } });
  };

  const [blocks, setBlocks] = useState(() => {
    return data.newsletterBlocks || [{id:'initial', type:'heading1', content:'学級通信', align:'center', color:'#1e293b'}];
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateData('newsletterBlocks', blocks);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [blocks, updateData]);
  const [activeId, setActiveId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [slashMenu, setSlashMenu] = useState({ show: false, x: 0, y: 0, targetId: null, targetIdx: null });
  const [showHelp, setShowHelp] = useState(false);
  
  const blockRefs = useRef({});
  const fileInputRef = useRef(null);
  const [uploadTargetId, setUploadTargetId] = useState(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;
      if (e.key === 'Escape') {
        if (showHelp) { setShowHelp(false); return; }
        if (slashMenu.show) { setSlashMenu({ show: false, x: 0, y: 0, targetId: null, targetIdx: null }); return; }
      }
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowHelp(p => !p);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showHelp, slashMenu.show]);

  const genId = () => Date.now().toString() + Math.random().toString(36).substr(2, 5);

  const addBlock = (type: string, index = blocks.length - 1, initialContent = '') => {
    const newBlock: any = { id: genId(), type, align: 'left', color: 'inherit', bgColor: 'transparent', content: initialContent };
    if(type === 'callout') newBlock.content = 'お知らせ';
    else if(type === 'columns') { newBlock.columns = [{id: genId(), type: 'text', content: ''}, {id: genId(), type: 'text', content: ''}]; }
    else if(type === 'schedule') { newBlock.targetWeek = formatDate(getMonday(new Date())); }
    else if(type === 'image') { newBlock.src = ''; }
    
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    setBlocks(newBlocks);
    setActiveId(newBlock.id);
    setTimeout(() => {
      if((blockRefs.current as any)[newBlock.id]) (blockRefs.current as any)[newBlock.id].focus();
    }, 50);
  };

  const updateBlock = (id, key, val) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [key]: val } : b));
  };

  const updateColumnBlock = (blockId, colId, key, val) => {
    setBlocks(prev => prev.map(b => {
      if (b.id === blockId && b.type === 'columns') {
        return {
          ...b,
          columns: b.columns.map(c => c.id === colId ? { ...c, [key]: val } : c)
        };
      }
      return b;
    }));
  };

  const removeBlock = (id, focusPrevIdx) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (focusPrevIdx !== undefined && focusPrevIdx >= 0) {
      setTimeout(() => {
        setBlocks(currentBlocks => {
          if(currentBlocks[focusPrevIdx]) {
            const prevId = currentBlocks[focusPrevIdx].id;
            setActiveId(prevId);
            setTimeout(() => {
              if(blockRefs.current[prevId]) {
                const el = blockRefs.current[prevId];
                el.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(el);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }, 50);
          }
          return currentBlocks;
        });
      }, 0);
    }
  };

  // キーボード操作 (Enter, Backspace)
  const handleKeyDown = (e, id, idx) => {
    // テキスト装飾ショートカット
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); return; }
      if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); return; }
      if (e.key === 'u') { e.preventDefault(); document.execCommand('underline'); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (slashMenu.show) return; // スラッシュメニュー表示中は無視
      
      const block = blocks[idx];
      const el = blockRefs.current[id];
      const isEmpty = el && (el.textContent === '' || el.textContent === '\n');

      if (['bulleted_list', 'numbered_list', 'todo'].includes(block.type)) {
        if (isEmpty) {
          // 空のリストでEnterを押した場合はテキストに戻す
          updateBlock(id, 'type', 'text');
        } else {
          // 中身がある場合は同じタイプのリストを次に追加
          addBlock(block.type, idx);
        }
      } else {
        addBlock('text', idx);
      }
    } else if (e.key === 'Backspace') {
      const el = blockRefs.current[id];
      if (el && (el.textContent === '' || el.textContent === '\n')) {
        e.preventDefault();
        const block = blocks[idx];
        if (idx > 0) {
          removeBlock(id, idx - 1);
        } else if (block.type !== 'text') {
          updateBlock(id, 'type', 'text');
        }
      }
    } else if (e.key === 'Escape') {
      setSlashMenu({ show: false });
    }
  };

  // 入力監視 (Markdownショートカット & スラッシュコマンド)
  const handleInput = (e, id, html, text) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;

    // Markdownショートカット (textContentで判定)
    if (text === '# ') { e.preventDefault(); updateBlock(id, 'type', 'heading1'); updateBlock(id, 'content', ''); e.target.innerHTML = ''; return; }
    if (text === '## ') { e.preventDefault(); updateBlock(id, 'type', 'heading2'); updateBlock(id, 'content', ''); e.target.innerHTML = ''; return; }
    if (text === '> ') { e.preventDefault(); updateBlock(id, 'type', 'callout'); updateBlock(id, 'content', ''); e.target.innerHTML = ''; return; }
    if (text === '- ' || text === '* ') { e.preventDefault(); updateBlock(id, 'type', 'bulleted_list'); updateBlock(id, 'content', ''); e.target.innerHTML = ''; return; }
    if (text === '1. ') { e.preventDefault(); updateBlock(id, 'type', 'numbered_list'); updateBlock(id, 'content', ''); e.target.innerHTML = ''; return; }
    if (text === '[] ') { e.preventDefault(); updateBlock(id, 'type', 'todo'); updateBlock(id, 'content', ''); updateBlock(id, 'checked', false); e.target.innerHTML = ''; return; }
    if (text === '---') { 
      e.preventDefault(); 
      updateBlock(id, 'type', 'divider'); 
      updateBlock(id, 'content', ''); 
      e.target.innerHTML = ''; 
      addBlock('text', blocks.findIndex(b=>b.id===id)); 
      return; 
    }

    // スラッシュコマンド
    if (text.endsWith('/')) {
      const rect = e.target.getBoundingClientRect();
      const idx = blocks.findIndex(b => b.id === id);
      setSlashMenu({ show: true, x: rect.left, y: rect.bottom + window.scrollY, targetId: id, targetIdx: idx });
    } else {
      if (slashMenu.show) setSlashMenu({ show: false });
    }

    updateBlock(id, 'content', html);
  };

  const executeSlashCommand = (type) => {
    const { targetId, targetIdx } = slashMenu;
    if (type === 'ai') {
      handleAiGenerate(targetIdx);
    } else if (type === 'image') {
      updateBlock(targetId, 'type', 'image');
      updateBlock(targetId, 'content', '');
      updateBlock(targetId, 'src', '');
      if(blockRefs.current[targetId]) blockRefs.current[targetId].innerHTML = '';
      setUploadTargetId({ blockId: targetId, colId: null });
      setTimeout(() => fileInputRef.current?.click(), 100);
    } else {
      updateBlock(targetId, 'type', type);
      updateBlock(targetId, 'content', '');
      if(blockRefs.current[targetId]) blockRefs.current[targetId].innerHTML = '';
      if(type === 'schedule') updateBlock(targetId, 'targetWeek', formatDate(getMonday(new Date())));
      if(type === 'columns') updateBlock(targetId, 'columns', [{id: genId(), type: 'text', content: ''}, {id: genId(), type: 'text', content: ''}]);
    }
    setSlashMenu({ show: false });
  };
  
  // D&D
  const handleDragStart = (idx: number) => {
    if (activeId === blocks[idx].id) return;
    setDraggedIdx(idx);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== idx) {
      setDragOverIdx(idx);
    }
  };
  const handleDragLeave = () => setDragOverIdx(null);
  const handleDrop = (idx: number) => {
    setDragOverIdx(null);
    if (draggedIdx === null || draggedIdx === idx) return;
    const newBlocks = [...blocks];
    const item = newBlocks.splice(draggedIdx, 1)[0];
    newBlocks.splice(idx, 0, item);
    setBlocks(newBlocks);
    setDraggedIdx(null);
  };

  // 画像アップロード処理
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !uploadTargetId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      if (uploadTargetId.colId) {
        updateColumnBlock(uploadTargetId.blockId, uploadTargetId.colId, 'src', base64);
        updateColumnBlock(uploadTargetId.blockId, uploadTargetId.colId, 'type', 'image');
      } else {
        updateBlock(uploadTargetId.blockId, 'src', base64);
      }
      setUploadTargetId(null);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  // カラム内のブロックタイプ変更
  const changeColumnType = (blockId, colId, newType) => {
    updateColumnBlock(blockId, colId, 'type', newType);
    if (newType === 'image') {
      setUploadTargetId({ blockId, colId });
      setTimeout(() => fileInputRef.current?.click(), 100);
    }
  };

  // テンプレート
  const applyTemplate = (tpl) => {
    if(window.confirm(`「${tpl.name}」を適用しますか？現在の内容は破棄されます。`)) {
      setBlocks(tpl.blocks.map(b => ({...b, id: genId()})));
      showToast('テンプレートを適用しました', 'success');
    }
  };

  // AI文面ジェネレーター
  const handleAiGenerate = async (insertIndex = blocks.length - 1) => {
    const promptText = window.prompt("どのような内容の文章を作成しますか？\n例：運動会に向けて頑張る子どもたちの様子");
    if(!promptText) return;
    const apiKey = data.settings.geminiApiKey;
    if(!apiKey) { showToast('設定タブでGemini APIキーを登録してください。', 'error'); return; }

    showToast("AIが文章を作成しています...", "info");
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: data.settings.geminiModelName || 'gemini-2.5-flash',
        contents: `あなたは小学校の先生です。保護者向けの学級通信に載せる文章を作成してください。\n内容: ${promptText}\n文字数: 150文字程度\nトーン: 温かく、前向きなトーン。HTMLタグは使わず、プレーンテキストで出力してください。`,
        config: { temperature: 0.7 }
      });
      
      const text = response.text || '';
      addBlock('text', insertIndex, text.replace(/\n/g, '<br>'));
      showToast('AIが文章を作成しました', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const renderBlockContent = (b, i) => {
    const commonProps = {
      ref: el => blockRefs.current[b.id] = el,
      onChange: val => updateBlock(b.id, 'content', val),
      onInput: (e, html, text) => handleInput(e, b.id, html, text),
      onKeyDown: e => handleKeyDown(e, b.id, i),
      autoFocus: activeId === b.id && !b.content
    };

    switch(b.type) {
      case 'heading1':
        return <EditableContent {...commonProps} html={b.content} tagName="h1" className="text-2xl md:text-3xl font-bold border-b-2 border-slate-800 pb-2 mb-2 mt-4" placeholder="見出し（大）" />;
      case 'heading2':
        return <EditableContent {...commonProps} html={b.content} tagName="h2" className="text-lg md:text-xl font-bold border-l-4 border-amber-500 pl-3 mb-1 mt-4" placeholder="見出し（小）" />;
      case 'text':
        return <EditableContent {...commonProps} html={b.content} tagName="div" className="text-[15px] leading-loose min-h-[1.5rem]" placeholder="テキストを入力... ('/' でコマンド呼び出し)" />;
      case 'bulleted_list':
        return (
          <div className="flex items-start gap-2 my-1">
            <span className="text-slate-500 mt-1.5 text-xs">●</span>
            <EditableContent {...commonProps} html={b.content} tagName="div" className="flex-1 text-[15px] leading-loose min-h-[1.5rem]" placeholder="リストを入力..." />
          </div>
        );
      case 'numbered_list': {
        let num = 1;
        for (let j = i - 1; j >= 0; j--) {
          if (blocks[j].type === 'numbered_list') num++;
          else break;
        }
        return (
          <div className="flex items-start gap-2 my-1">
            <span className="text-slate-500 mt-0.5 font-bold w-5 text-right">{num}.</span>
            <EditableContent {...commonProps} html={b.content} tagName="div" className="flex-1 text-[15px] leading-loose min-h-[1.5rem]" placeholder="番号付きリストを入力..." />
          </div>
        );
      }
      case 'todo':
        return (
          <div className="flex items-start gap-2 my-1">
            <input type="checkbox" checked={b.checked || false} onChange={e => updateBlock(b.id, 'checked', e.target.checked)} className="mt-1.5 w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-500" />
            <EditableContent {...commonProps} html={b.content} tagName="div" className={`flex-1 text-[15px] leading-loose min-h-[1.5rem] ${b.checked ? 'line-through text-slate-400' : ''}`} placeholder="ToDoを入力..." />
          </div>
        );
      case 'callout':
        return (
          <div className="flex gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl my-2">
             <span className="text-xl">💡</span>
             <EditableContent {...commonProps} html={b.content} tagName="div" className="flex-1 text-[15px] leading-relaxed" placeholder="お知らせ・ポイントを入力" />
          </div>
        );
      case 'image':
        return (
          <div className="my-4 relative group/img" contentEditable={false}>
            {b.src ? (
              <img src={b.src} alt="Uploaded" className="max-w-full rounded-lg shadow-sm" style={{ maxHeight: '400px', objectFit: 'contain' }} />
            ) : (
              <div 
                className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-100 hover:border-amber-400 transition-colors"
                onClick={() => { setUploadTargetId({ blockId: b.id, colId: null }); fileInputRef.current?.click(); }}
              >
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-sm font-bold">クリックして画像をアップロード</span>
              </div>
            )}
            {b.src && (
              <button 
                onClick={() => { setUploadTargetId({ blockId: b.id, colId: null }); fileInputRef.current?.click(); }}
                className="absolute top-2 right-2 bg-slate-800/70 text-white p-2 rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity print:hidden"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      case 'columns':
        return (
          <div className="flex flex-col md:flex-row gap-6 my-2" contentEditable={false}>
            {(b.columns || []).map((col, colIdx) => (
              <div key={col.id} className="flex-1 p-2 rounded hover:bg-slate-50 transition-colors relative group/col">
                {/* カラム内ツールバー */}
                <div className="absolute -top-8 right-0 bg-white border border-slate-200 shadow-sm rounded-lg flex items-center p-1 gap-1 z-20 opacity-0 group-hover/col:opacity-100 transition-opacity print:hidden">
                  <button onClick={() => changeColumnType(b.id, col.id, 'text')} className={`p-1 rounded ${col.type==='text'?'bg-slate-100 text-amber-600':'hover:bg-slate-50 text-slate-500'}`} title="テキスト"><Type className="w-3.5 h-3.5"/></button>
                  <button onClick={() => changeColumnType(b.id, col.id, 'image')} className={`p-1 rounded ${col.type==='image'?'bg-slate-100 text-amber-600':'hover:bg-slate-50 text-slate-500'}`} title="画像"><ImageIcon className="w-3.5 h-3.5"/></button>
                </div>

                {col.type === 'text' ? (
                  <EditableContent 
                    html={col.content} 
                    tagName="div" 
                    className="text-[15px] leading-relaxed min-h-[3rem]" 
                    onChange={val => updateColumnBlock(b.id, col.id, 'content', val)} 
                    placeholder="テキストを入力" 
                  />
                ) : (
                  <div className="relative group/imgcol">
                    {col.src ? (
                      <img src={col.src} alt="Column content" className="w-full rounded-lg shadow-sm object-cover" />
                    ) : (
                      <div 
                        className="w-full h-24 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-200 hover:border-amber-400"
                        onClick={() => { setUploadTargetId({ blockId: b.id, colId: col.id }); fileInputRef.current?.click(); }}
                      >
                        <ImageIcon className="w-6 h-6 mb-1" />
                        <span className="text-xs font-bold">画像を選択</span>
                      </div>
                    )}
                    {col.src && (
                      <button 
                        onClick={() => { setUploadTargetId({ blockId: b.id, colId: col.id }); fileInputRef.current?.click(); }}
                        className="absolute top-2 right-2 bg-slate-800/70 text-white p-1.5 rounded-lg opacity-0 group-hover/imgcol:opacity-100 transition-opacity print:hidden"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      case 'divider':
        return <hr className="border-t border-dashed border-slate-400 my-6" />;
      case 'qrcode':
        return (
          <div className="flex flex-col items-center my-4" contentEditable={false}>
            {b.url ? (
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(b.url)}`} alt="QR" className="w-[120px] h-[120px] mb-2 rounded shadow-sm" />
            ) : (
              <div className="w-[120px] h-[120px] bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center rounded text-slate-400 mb-2 text-xs">QR画像</div>
            )}
            <input type="text" value={b.url||''} onChange={e=>updateBlock(b.id, 'url', e.target.value)} className="text-xs border border-slate-200 rounded p-1.5 text-center w-64 print:hidden outline-none focus:border-amber-400 bg-slate-50" placeholder="URLを入力するとQRコードになります" />
          </div>
        );
      case 'schedule':
        const weekData = data.weeklyPlans[b.targetWeek || formatDate(getMonday(new Date()))];
        return (
          <div className="border border-slate-200 rounded-xl overflow-hidden my-4" contentEditable={false}>
            <div className="bg-slate-50 p-2 border-b border-slate-200 flex justify-between items-center">
              <span className="font-bold text-slate-700 text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-500"/> 今週の予定表</span>
              <input type="date" value={(b.targetWeek || formatDate(getMonday(new Date()))).replace(/\//g, '-')} 
                onChange={e => updateBlock(b.id, 'targetWeek', e.target.value.replace(/-/g, '/'))}
                className="text-xs border border-slate-200 rounded p-1 outline-none focus:border-amber-400 font-bold text-slate-600" />
            </div>
            <table className="w-full text-sm">
              <tbody>
                {weekData ? weekData.slice(0, 5).map((day, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <th className="p-2 bg-slate-50 w-16 text-center text-slate-600 font-bold">{day.dayLabel}</th>
                    <td className="p-2 text-slate-700">
                      {day.event && <div className="text-red-500 text-xs font-bold mb-1">{day.event}</div>}
                      <div className="text-xs">{day.items ? <span className="font-bold text-slate-500">持ち物: <span className="font-normal text-slate-700">{day.items}</span></span> : <span className="text-slate-400">通常日課</span>}</div>
                    </td>
                  </tr>
                )) : <tr><td className="p-4 text-center text-slate-400 text-xs">予定データがありません</td></tr>}
              </tbody>
            </table>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="h-full print:h-auto flex flex-col md:flex-row print:block bg-slate-100" onClick={() => { setActiveId(null); setSlashMenu({show: false}); }}>
      {/* 隠しファイルインプット */}
      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

      {/* 左サイドパレット */}
      <div className="print:hidden w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 shrink-0" onClick={e=>e.stopPropagation()}>
        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          
          <div>
            <h3 className="font-bold text-xs text-slate-400 mb-3 tracking-widest uppercase">ブロック追加</h3>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
              <button onClick={()=>addBlock('text')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><AlignLeft className="w-4 h-4 text-slate-400"/> テキスト</button>
              <button onClick={()=>addBlock('heading1')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><Heading1 className="w-4 h-4 text-slate-400"/> 見出し(大)</button>
              <button onClick={()=>addBlock('heading2')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><Heading2 className="w-4 h-4 text-slate-400"/> 見出し(小)</button>
              <button onClick={()=>addBlock('bulleted_list')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><List className="w-4 h-4 text-slate-400"/> 箇条書き</button>
              <button onClick={()=>addBlock('numbered_list')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><ListOrdered className="w-4 h-4 text-slate-400"/> 番号付き</button>
              <button onClick={()=>addBlock('todo')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><CheckSquare className="w-4 h-4 text-slate-400"/> ToDo</button>
              <button onClick={()=>addBlock('image')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><ImageIcon className="w-4 h-4 text-slate-400"/> 画像</button>
              <button onClick={()=>addBlock('callout')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><MessageSquare className="w-4 h-4 text-slate-400"/> コールアウト</button>
              <button onClick={()=>addBlock('columns')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><Columns className="w-4 h-4 text-slate-400"/> 2段組み</button>
              <button onClick={()=>addBlock('schedule')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><Calendar className="w-4 h-4 text-slate-400"/> 予定表</button>
              <button onClick={()=>addBlock('qrcode')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><QrCode className="w-4 h-4 text-slate-400"/> QRコード</button>
              <button onClick={()=>addBlock('divider')} className="text-left p-2 rounded-lg hover:bg-slate-100 text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors"><Minus className="w-4 h-4 text-slate-400"/> 区切り線</button>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-xs text-slate-400 mb-3 tracking-widest uppercase">AI 連携</h3>
            <button onClick={() => handleAiGenerate()} className="w-full text-left p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-sm font-bold text-emerald-700 flex items-center gap-3 transition-colors">
              <Wand2 className="w-4 h-4"/> AI文面ジェネレーター
            </button>
          </div>

          <div>
            <h3 className="font-bold text-xs text-slate-400 mb-3 tracking-widest uppercase">テンプレート</h3>
            <div className="space-y-2">
              {getTemplates(data.settings).map((tpl, i) => (
                <button key={i} onClick={() => applyTemplate(tpl)} className="w-full text-left p-2 rounded-lg border border-slate-200 hover:border-amber-400 text-sm font-bold text-slate-600 transition-colors bg-slate-50">{tpl.name}</button>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100">
            <button onClick={() => setShowHelp(true)} className="w-full text-left p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-bold text-slate-600 flex items-center gap-3 transition-colors">
              <HelpCircle className="w-4 h-4 text-slate-400"/> ショートカット一覧
            </button>
          </div>
          
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <button onClick={() => window.print()} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex justify-center items-center gap-2 shadow-sm transition-colors"><Printer className="w-4 h-4"/> 印刷・PDF保存</button>
        </div>
      </div>

      {/* エディタ領域 (A4) */}
      <div className="flex-1 overflow-auto print:overflow-visible p-4 md:p-8 flex justify-center print-area relative print:block">
        <div className="w-full max-w-[800px] min-h-[1131px] bg-white shadow-md p-10 md:p-16 border border-slate-200 relative print:border-none print:shadow-none print:p-0 print:max-w-none print:min-h-0">
          
          {blocks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 print:hidden opacity-60">
              <FileText className="w-16 h-16 mb-4" />
              <p className="font-bold">左のパレットからブロックを追加して作成開始</p>
            </div>
          )}

          {blocks.map((b, i) => {
            const isActive = activeId === b.id;
            const isHover = hoverId === b.id;
            return (
              <div 
                key={b.id} 
                className={`relative group border-2 rounded-lg transition-colors 
                  ${isActive ? 'border-amber-200 bg-amber-50/10' : 'border-transparent hover:border-slate-100'} 
                  ${draggedIdx === i ? 'opacity-30' : ''}
                  ${dragOverIdx === i ? 'border-t-amber-500 border-t-4' : ''}`}
                style={{ padding: b.type === 'callout' || b.type === 'columns' || b.type === 'schedule' || b.type === 'image' ? '0' : '2px 4px' }}
                onMouseEnter={() => setHoverId(b.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={(e) => { e.stopPropagation(); setActiveId(b.id); }}
                draggable={!isActive && isHover} // 編集時はドラッグOFF
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(i)}
              >
                {/* 左ハンドル */}
                <div className="absolute -left-14 top-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white shadow-sm border border-slate-200 rounded p-1 z-10 print:hidden transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); addBlock('text', i); }} className="hover:bg-slate-100 rounded text-slate-400 hover:text-amber-500"><Plus className="w-4 h-4"/></button>
                  <div className="hover:bg-slate-100 rounded text-slate-400 cursor-grab"><GripVertical className="w-4 h-4"/></div>
                </div>

                {/* ツールバー */}
                {isActive && (
                  <div className="absolute -top-10 left-0 bg-slate-800 text-white shadow-lg rounded-lg flex items-center p-1.5 gap-1 z-50 print:hidden" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>updateBlock(b.id, 'align', 'left')} className={`p-1 rounded ${b.align==='left'?'bg-slate-600':'hover:bg-slate-700'}`}><AlignLeft className="w-4 h-4"/></button>
                    <button onClick={()=>updateBlock(b.id, 'align', 'center')} className={`p-1 rounded ${b.align==='center'?'bg-slate-600':'hover:bg-slate-700'}`}><AlignCenter className="w-4 h-4"/></button>
                    <button onClick={()=>updateBlock(b.id, 'align', 'right')} className={`p-1 rounded ${b.align==='right'?'bg-slate-600':'hover:bg-slate-700'}`}><AlignRight className="w-4 h-4"/></button>
                    <div className="w-px h-4 bg-slate-600 mx-1"></div>
                    <select value={b.color||'inherit'} onChange={e=>updateBlock(b.id, 'color', e.target.value)} className="text-xs bg-transparent border-none outline-none cursor-pointer text-white font-bold p-1 hover:bg-slate-700 rounded">
                      <option value="inherit" className="text-black">色: 標準</option>
                      <option value="#ef4444" className="text-red-500">色: 赤</option>
                      <option value="#3b82f6" className="text-blue-500">色: 青</option>
                      <option value="#10b981" className="text-green-500">色: 緑</option>
                    </select>
                    <div className="w-px h-4 bg-slate-600 mx-1"></div>
                    <button onClick={()=>removeBlock(b.id, i - 1)} className="p-1 rounded hover:bg-red-500 text-slate-300 hover:text-white"><Trash2 className="w-4 h-4"/></button>
                  </div>
                )}

                {/* コンテンツ */}
                <div style={{ textAlign: b.align, color: b.color!=='inherit'?b.color:undefined }}>
                  {renderBlockContent(b, i)}
                </div>
              </div>
            );
          })}

          {/* スラッシュコマンドメニュー */}
          {slashMenu.show && (
            <div 
              className="absolute bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 w-64 print:hidden" 
              style={{ top: slashMenu.y + 5, left: slashMenu.x }}
              onClick={e=>e.stopPropagation()}
            >
              <div className="px-3 pb-2 mb-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">ブロックに変換</div>
              <button onClick={() => executeSlashCommand('heading1')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><Heading1 className="w-4 h-4 text-slate-400"/> 見出し 1</button>
              <button onClick={() => executeSlashCommand('heading2')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><Heading2 className="w-4 h-4 text-slate-400"/> 見出し 2</button>
              <button onClick={() => executeSlashCommand('bulleted_list')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><List className="w-4 h-4 text-slate-400"/> 箇条書きリスト</button>
              <button onClick={() => executeSlashCommand('numbered_list')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><ListOrdered className="w-4 h-4 text-slate-400"/> 番号付きリスト</button>
              <button onClick={() => executeSlashCommand('todo')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><CheckSquare className="w-4 h-4 text-slate-400"/> ToDoリスト</button>
              <button onClick={() => executeSlashCommand('image')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><ImageIcon className="w-4 h-4 text-slate-400"/> 画像</button>
              <button onClick={() => executeSlashCommand('columns')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><Columns className="w-4 h-4 text-slate-400"/> 2段組み (画像可)</button>
              <button onClick={() => executeSlashCommand('callout')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><MessageSquare className="w-4 h-4 text-slate-400"/> コールアウト</button>
              <button onClick={() => executeSlashCommand('schedule')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><Calendar className="w-4 h-4 text-slate-400"/> 予定表 (週案から自動)</button>
              <button onClick={() => executeSlashCommand('divider')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-3"><Minus className="w-4 h-4 text-slate-400"/> 区切り線</button>
              <div className="px-3 py-2 mt-1 mb-1 border-y border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">AI アシスタント</div>
              <button onClick={() => executeSlashCommand('ai')} className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-emerald-700 text-sm font-bold flex items-center gap-3"><Sparkles className="w-4 h-4"/> AIに文章を書かせる</button>
            </div>
          )}

        </div>
      </div>

      {/* ショートカット一覧モーダル */}
      {showHelp && (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4 border-b pb-2"><HelpCircle className="w-5 h-5 text-indigo-500"/> ショートカット一覧</h3>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <table className="w-full text-sm text-left">
                <tbody>
                  <tr className="border-b"><th className="py-2 w-28">Enter</th><td className="py-2 text-slate-600">次のブロックを作成</td></tr>
                  <tr className="border-b"><th className="py-2">Backspace</th><td className="py-2 text-slate-600">空ブロック削除/テキストに戻す</td></tr>
                  <tr className="border-b"><th className="py-2">/ (スラッシュ)</th><td className="py-2 text-slate-600">コマンドメニューを開く</td></tr>
                  <tr className="border-b"><th className="py-2">Ctrl + B</th><td className="py-2 text-slate-600">太字</td></tr>
                  <tr className="border-b"><th className="py-2">Ctrl + I</th><td className="py-2 text-slate-600">斜体</td></tr>
                  <tr className="border-b"><th className="py-2">Ctrl + U</th><td className="py-2 text-slate-600">下線</td></tr>
                  <tr className="border-b"><th className="py-2"># + Space</th><td className="py-2 text-slate-600">見出し1</td></tr>
                  <tr className="border-b"><th className="py-2">## + Space</th><td className="py-2 text-slate-600">見出し2</td></tr>
                  <tr className="border-b"><th className="py-2">- + Space</th><td className="py-2 text-slate-600">箇条書きリスト</td></tr>
                  <tr className="border-b"><th className="py-2">1. + Space</th><td className="py-2 text-slate-600">番号付きリスト</td></tr>
                  <tr className="border-b"><th className="py-2">[] + Space</th><td className="py-2 text-slate-600">ToDoリスト</td></tr>
                  <tr className="border-b"><th className="py-2">&gt; + Space</th><td className="py-2 text-slate-600">コールアウト</td></tr>
                  <tr className="border-b"><th className="py-2">---</th><td className="py-2 text-slate-600">区切り線</td></tr>
                  <tr><th className="py-2">? / Esc</th><td className="py-2 text-slate-600">ヘルプ開閉 / 閉じる</td></tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-center">
              <button onClick={() => setShowHelp(false)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm w-full">閉じる</button>
            </div>
          </div>
        </div>
      )}
      <GuideModal isOpen={showGuide} onClose={closeGuide} viewId="newsletter" />
    </div>
  );
}

// ------------------------------------------
// 📊 5. 時数集計ビュー (HoursView) - 正規表現分数の完全対応
// ------------------------------------------
const extractHours = (str) => {
  if (!str) return [];
  const normalized = str.replace(/　/g, ' ').trim();
  const regex = /([^\s\d/.]+)(?:\s*(\d+\/\d+|\d+\.\d+|\d+))?/g;
  let match;
  const results = [];
  while ((match = regex.exec(normalized)) !== null) {
    if (match[1].trim() === '') continue;
    const subject = match[1].trim();
    let hours = 1; 
    if (match[2]) {
      if (match[2].includes('/')) {
        const [n, d] = match[2].split('/');
        hours = parseInt(n, 10) / parseInt(d, 10);
      } else {
        hours = parseFloat(match[2]);
      }
    }
    results.push({ subject, hours });
  }
  return results;
};

function HoursView() {
  const { data, updateData, currentDate, setCurrentDate } = useContext(AppContext as any);
  const [showGuide, setShowGuide] = useState(() => !data.settings.onboarding?.hours);

  const closeGuide = () => {
    setShowGuide(false);
    updateData('settings', { ...data.settings, onboarding: { ...data.settings.onboarding, hours: true } });
  };

  const [summary, setSummary] = useState<any[]>([]);

  // 選択中の週の月曜日と日曜日を計算
  const currentMonday = getMonday(currentDate);
  const targetSunday = new Date(currentMonday);
  targetSunday.setDate(targetSunday.getDate() + 6);
  targetSunday.setHours(23, 59, 59, 999);

  const monthsList = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

  useEffect(() => {
    const counts: Record<string, { total: number, upToTarget: number, months: Record<number, number> }> = {};
    
    data.settings.subjects.forEach((sub: any) => {
      counts[sub.name] = { total: 0, upToTarget: 0, months: {} };
      monthsList.forEach(m => counts[sub.name].months[m] = 0);
    });

    Object.values(data.weeklyPlans).forEach((week: any) => {
      week.forEach((day: any) => {
        if (!day.date) return;
        const [y, m, d] = day.date.split('/').map(Number);
        const dayDate = new Date(y, m - 1, d);
        const month = m;
        const isUpToTarget = dayDate <= targetSunday;

        const addHours = (subjectStr: string) => {
          const parsed = extractHours(subjectStr);
          parsed.forEach(({ subject, hours }: any) => {
            if (!counts[subject]) {
              counts[subject] = { total: 0, upToTarget: 0, months: {} };
              monthsList.forEach(m => counts[subject].months[m] = 0);
            }
            counts[subject].total += hours;
            if (isUpToTarget) counts[subject].upToTarget += hours;
            counts[subject].months[month] += hours;
          });
        };

        if(day.periods) {
          Object.values(day.periods).forEach((p: any) => {
            if(p && p.subject) addHours(p.subject);
          });
        }
        if(day.morning) {
          addHours(day.morning);
        }
      });
    });

    const result = data.settings.subjects.map((sub: any) => {
      const c = counts[sub.name];
      const target = sub.targetHours; 
      const current = c.upToTarget;
      const percent = target > 0 ? Math.round((current / target) * 100) : 0;
      return { 
        ...sub, 
        current: Math.round(current * 100) / 100, 
        total: Math.round(c.total * 100) / 100,
        percent, 
        target,
        months: c.months
      };
    });
    setSummary(result);
  }, [data.weeklyPlans, data.settings.subjects, targetSunday.getTime()]);

  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  return (
    <div className="h-full print:h-auto overflow-auto print:overflow-visible p-4 md:p-8 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-indigo-600 w-8 h-8" />
            <h2 className="text-2xl font-bold text-slate-800">年間・教科別 実施時数</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowGuide(true)} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"><Info className="w-5 h-5"/></button>
            <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
              <button onClick={handlePrevWeek} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span>{formatDate(currentMonday)} の週まで</span>
              </div>
              <button onClick={handleNextWeek} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-600 text-sm">
              <tr>
                <th className="p-3 font-bold border-b border-slate-200 sticky left-0 bg-slate-50 z-10">教科</th>
                <th className="p-3 font-bold border-b border-slate-200 text-right w-24">目標時数</th>
                <th className="p-3 font-bold border-b border-slate-200 text-right w-24 text-indigo-600">対象週まで</th>
                <th className="p-3 font-bold border-b border-slate-200 w-48">進捗ゲージ</th>
                {monthsList.map(m => (
                  <th key={m} className="p-3 font-bold border-b border-slate-200 text-center w-12">{m}月</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-bold">
              {summary.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-slate-700 sticky left-0 bg-white z-10">{row.name}</td>
                  <td className="p-3 text-right text-slate-500">{row.target}</td>
                  <td className="p-3 text-right text-indigo-600 text-lg">{row.current}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div className={`h-full ${row.percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(row.percent, 100)}%` }}></div>
                      </div>
                      <span className="text-xs text-slate-500 min-w-[36px] text-right">{row.percent}%</span>
                    </div>
                  </td>
                  {monthsList.map(m => (
                    <td key={m} className="p-3 text-center text-slate-500 font-medium border-l border-slate-50">
                      {row.months[m] > 0 ? Math.round(row.months[m] * 100) / 100 : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <GuideModal isOpen={showGuide} onClose={closeGuide} viewId="hours" />
    </div>
  );
}

// ------------------------------------------
// ⚙️ 6. 設定ビュー
// ------------------------------------------
function SettingsView() {
  const { data, updateData, showToast } = useContext(AppContext);
  const [showGuide, setShowGuide] = useState(() => !data.settings.onboarding?.settings);

  const closeGuide = () => {
    setShowGuide(false);
    updateData('settings', { ...data.settings, onboarding: { ...data.settings.onboarding, settings: true } });
  };

  const [formData, setFormData] = useState(data.settings);
  const [syncCode, setSyncCode] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<{name: string, displayName: string}[]>(
    data.settings.availableModels || [
      { name: 'gemini-2.5-flash', displayName: 'gemini-2.5-flash (推奨・高速)' },
      { name: 'gemini-3-flash-preview', displayName: 'gemini-3-flash-preview' },
      { name: 'gemini-3.1-pro-preview', displayName: 'gemini-3.1-pro-preview (高精度)' },
    ]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateData('settings', formData);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [formData, updateData]);

  const handleSave = () => { updateData('settings', formData); showToast('設定を保存しました', 'success'); };
  const handleExport = () => { navigator.clipboard.writeText(btoa(encodeURIComponent(JSON.stringify(data)))); showToast('コピーしました！', 'success'); };
  const handleImport = () => {
    if(!syncCode) return;
    try {
      if(window.confirm('上書きしますか？')) {
        const decoded = JSON.parse(decodeURIComponent(atob(syncCode)));
        updateData('settings', decoded.settings); updateData('weeklyPlans', decoded.weeklyPlans); updateData('tasks', decoded.tasks); updateData('unitMaster', decoded.unitMaster||[]); updateData('newsletterBlocks', decoded.newsletterBlocks||[]);
        setSyncCode(''); showToast('復元しました！', 'success');
      }
    } catch(e) { showToast('コードが不正です', 'error'); }
  };

  const handleBaseTimetableSave = () => {
    if(!formData.baseTimetable) {
      const template = Array(5).fill(null).map(() => ({ morning: '', periods: { period1:{subject:''}, period2:{subject:''}, period3:{subject:''}, period4:{subject:''}, period5:{subject:''}, period6:{subject:''} }}));
      setFormData({...formData, baseTimetable: template});
      showToast('空のテンプレートを作成しました。右下の「設定を保存」を押してください。', 'success');
    }
  };

  const fetchModels = async () => {
    if (!formData.geminiApiKey) {
      showToast('APIキーを入力してください', 'error');
      return;
    }
    setIsLoadingModels(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${formData.geminiApiKey}`);
      if (!res.ok) throw new Error('Failed to fetch models');
      const json = await res.json();
      const models = json.models
        .filter((m: any) => m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini'))
        .map((m: any) => ({
          name: m.name.replace('models/', ''),
          displayName: m.displayName || m.name.replace('models/', '')
        }));
      if (models.length > 0) {
        setAvailableModels(models);
        setFormData(prev => ({ ...prev, availableModels: models }));
        showToast('モデル一覧を更新しました', 'success');
      }
    } catch (error) {
      console.error(error);
      showToast('モデル一覧の取得に失敗しました', 'error');
    } finally {
      setIsLoadingModels(false);
    }
  };

  return (
    <div className="h-full print:h-auto overflow-auto print:overflow-visible p-4 md:p-8 bg-slate-50">
      <div className="max-w-3xl mx-auto space-y-8 pb-20">
        <div className="flex justify-end">
          <button onClick={() => setShowGuide(true)} className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"><Info className="w-5 h-5"/></button>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2"><Settings className="w-5 h-5 text-slate-500" /> 基本情報</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-bold text-slate-500 mb-1">学校名</label><input type="text" value={formData.schoolName} onChange={e => {
              const newData = {...formData, schoolName: e.target.value};
              setFormData(newData);
            }} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold outline-none focus:ring-2 focus:ring-amber-400" /></div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">学年</label>
                <select value={formData.grade || 3} onChange={e => {
                  const newGrade = parseInt(e.target.value, 10);
                  const newData = {...formData, grade: newGrade, subjects: STANDARD_HOURS[newGrade].map(s => ({...s}))};
                  setFormData(newData);
                  showToast(`学年を${newGrade}年に変更し、標準時数にリセットしました`, 'success');
                }} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold outline-none focus:ring-2 focus:ring-amber-400">
                  {[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}年</option>)}
                </select>
              </div>
              <div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">組</label>
                <div className="flex items-center gap-1">
                  <input type="number" value={formData.classNumber || 1} onChange={e => {
                    const newData = {...formData, classNumber: parseInt(e.target.value, 10)};
                    setFormData(newData);
                  }} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold outline-none focus:ring-2 focus:ring-amber-400" />
                  <span className="text-sm font-bold text-slate-600">組</span>
                </div>
              </div>
            </div>
            <div><label className="block text-xs font-bold text-slate-500 mb-1">担任名</label><input type="text" value={formData.teacherName} onChange={e => {
              const newData = {...formData, teacherName: e.target.value};
              setFormData(newData);
            }} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold outline-none focus:ring-2 focus:ring-amber-400" /></div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2 mt-6"><BookOpen className="w-5 h-5 text-slate-500" /> 教科と目標時数</h3>
          <p className="text-xs text-slate-500">学年を変更すると標準時数にリセットされます。必要に応じてカスタマイズしてください。</p>
          <div className="space-y-2">
            {formData.subjects.map((sub: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <input type="text" value={sub.name} onChange={e => {
                  const newSubjects = [...formData.subjects];
                  newSubjects[idx].name = e.target.value;
                  const newData = {...formData, subjects: newSubjects};
                  setFormData(newData);
                }} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold outline-none focus:ring-2 focus:ring-amber-400" />
                <input type="number" value={sub.targetHours} onChange={e => {
                  const newSubjects = [...formData.subjects];
                  newSubjects[idx].targetHours = parseInt(e.target.value, 10) || 0;
                  const newData = {...formData, subjects: newSubjects};
                  setFormData(newData);
                }} className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold outline-none focus:ring-2 focus:ring-amber-400 text-right" />
                <span className="text-sm font-bold text-slate-500">時間</span>
                <button onClick={() => {
                  const newSubjects = formData.subjects.filter((_: any, i: number) => i !== idx);
                  const newData = {...formData, subjects: newSubjects};
                  setFormData(newData);
                }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => {
              const newSubjects = [...formData.subjects, { name: '新しい教科', targetHours: 0 }];
              const newData = {...formData, subjects: newSubjects};
              setFormData(newData);
            }} className="mt-2 px-4 py-2 bg-slate-100 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1"><Plus className="w-4 h-4" /> 教科を追加</button>
          </div>

          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2 mt-6"><CalendarClock className="w-5 h-5 text-slate-500" /> 固定時間割</h3>
          <p className="text-xs text-slate-500">週案の「固定時間割」ボタンを押した際に反映される、基本の時間割を設定します。</p>
          {!formData.baseTimetable ? (
            <button onClick={handleBaseTimetableSave} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 text-sm">固定時間割を作成する</button>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-slate-200 bg-slate-100 p-2 w-16"></th>
                    {['月', '火', '水', '木', '金'].map(day => (
                      <th key={day} className="border border-slate-200 bg-slate-100 p-2 text-center">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-200 bg-slate-50 p-2 text-center font-bold text-slate-600">朝学習</td>
                    {formData.baseTimetable.map((day: any, i: number) => (
                      <td key={i} className="border border-slate-200 p-1">
                        <input type="text" value={day.morning || ''} onChange={e => {
                          const newBase = [...formData.baseTimetable];
                          newBase[i] = { ...newBase[i], morning: e.target.value };
                          setFormData({...formData, baseTimetable: newBase});
                        }} className="w-full p-1 outline-none focus:bg-amber-50 rounded" placeholder="朝学習" />
                      </td>
                    ))}
                  </tr>
                  {[1,2,3,4,5,6].map(p => (
                    <tr key={p}>
                      <td className="border border-slate-200 bg-slate-50 p-2 text-center font-bold text-slate-600">{p}校時</td>
                      {formData.baseTimetable.map((day: any, i: number) => (
                        <td key={i} className="border border-slate-200 p-1">
                          <input type="text" value={day.periods?.[`period${p}`]?.subject || ''} onChange={e => {
                            const newBase = [...formData.baseTimetable];
                            newBase[i] = { ...newBase[i], periods: { ...newBase[i].periods, [`period${p}`]: { subject: e.target.value } } };
                            setFormData({...formData, baseTimetable: newBase});
                          }} className="w-full p-1 outline-none focus:bg-amber-50 rounded" placeholder="教科" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2 mt-6"><Sparkles className="w-5 h-5 text-emerald-500" /> AI・システム設定</h3>
          <p className="text-xs text-slate-500">タスクの自動抽出機能等を利用するための Gemini API キーを設定します。（ブラウザにのみ保存されます）</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-bold text-slate-500 mb-1">Gemini API キー</label><input type="password" value={formData.geminiApiKey} onChange={e => {
              const newData = {...formData, geminiApiKey: e.target.value};
              setFormData(newData);
            }} placeholder="AIStudioで取得したキー..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold outline-none focus:ring-2 focus:ring-emerald-400" /></div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-500">使用モデル</label>
                <button 
                  onClick={fetchModels} 
                  disabled={!formData.geminiApiKey || isLoadingModels}
                  className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-0.5 rounded flex items-center gap-1 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                  最新を取得
                </button>
              </div>
              <select value={formData.geminiModelName} onChange={e => {
                const newData = {...formData, geminiModelName: e.target.value};
                setFormData(newData);
              }} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold outline-none focus:ring-2 focus:ring-emerald-400">
                {availableModels.map(m => (
                  <option key={m.name} value={m.name}>{m.displayName}</option>
                ))}
                {!availableModels.find(m => m.name === formData.geminiModelName) && formData.geminiModelName && (
                  <option value={formData.geminiModelName}>{formData.geminiModelName}</option>
                )}
              </select>
            </div>
          </div>

          <div className="pt-3 border-t mt-4 text-right">
            <button onClick={handleSave} className="bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-amber-600 active:scale-95 inline-flex items-center gap-2"><Save className="w-4 h-4"/> 設定を保存</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-slate-500" /> データ同期（クラウド不要）</h3>
          <div className="flex flex-col gap-2">
            <button onClick={handleExport} className="w-fit bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 active:scale-95 shadow-sm"><Download className="w-4 h-4" /> データを書き出す(コピー)</button>
          </div>
          <div className="flex flex-col gap-2 pt-5 border-t border-slate-100">
            <textarea value={syncCode} onChange={e => setSyncCode(e.target.value)} placeholder="コピーしたコードを貼り付け..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-amber-400 h-24 resize-none" />
            <button onClick={handleImport} className="w-fit bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 active:scale-95 shadow-sm"><Upload className="w-4 h-4" /> データを復元・上書き</button>
          </div>
        </div>
      </div>
      <GuideModal isOpen={showGuide} onClose={closeGuide} viewId="settings" />
    </div>
  );
}
