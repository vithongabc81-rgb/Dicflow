import React, { useState } from 'react';
import {
  Compass,
  PlusCircle,
  BookMarked,
  AlertTriangle,
  BarChart3,
  Sun,
  Moon,
  Flame,
  LogOut,
  LogIn,
  Headphones,
  Sparkles,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { ExplorePage } from './pages/ExplorePage';
import { PracticePage } from './pages/PracticePage';
import { CreateLessonPage } from './pages/CreateLessonPage';
import { VocabPage } from './pages/VocabPage';
import { MistakesPage } from './pages/MistakesPage';
import { DashboardPage } from './pages/DashboardPage';
import type { PageRoute } from './types';

function getInitials(name: string): string {
  const cleaned = name.replace(/\([^)]*\)/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AppShell() {
  const { user, theme, toggleTheme, setAuthModalOpen, logout } = useAuth();
  const [route, setRoute] = useState<PageRoute>('explore');
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);

  const openLesson = (id: number) => {
    setActiveLessonId(id);
    setRoute('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateTo = (next: PageRoute) => {
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems: {
    id: PageRoute;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'explore', label: 'Khám phá', shortLabel: 'Khám phá', icon: Compass },
    { id: 'create', label: 'Tạo bài học', shortLabel: 'Tạo bài', icon: PlusCircle },
    { id: 'vocab', label: 'Từ vựng & Flashcard', shortLabel: 'Flashcard', icon: BookMarked },
    { id: 'mistakes', label: 'Câu hay sai', shortLabel: 'Câu sai', icon: AlertTriangle },
    { id: 'dashboard', label: 'Thống kê', shortLabel: 'Tiến độ', icon: BarChart3 },
  ];

  const showMobileDock = route !== 'practice';

  return (
    <div className="min-h-screen flex flex-col text-slate-900 dark:text-slate-100">
      {/* Frosted Glass Floating Header */}
      <header className="sticky top-0 z-40 bg-white/75 dark:bg-[#090e1c]/80 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 shadow-[0_1px_20px_-8px_rgba(15,23,42,0.12)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Emblem */}
          <button
            type="button"
            onClick={() => navigateTo('explore')}
            className="group flex items-center gap-2.5 cursor-pointer shrink-0"
          >
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <Headphones className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#090e1c]" />
            </div>
            <div className="text-left">
              <div className="font-display font-extrabold text-lg tracking-tight leading-none bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 dark:from-indigo-300 dark:via-violet-300 dark:to-fuchsia-300 bg-clip-text text-transparent">
                DictaFlow
              </div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide mt-0.5 hidden sm:block">
                Video Dictation Studio
              </div>
            </div>
          </button>

          {/* Desktop Pill Navigation */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 dark:bg-white/[0.06] border border-slate-200/70 dark:border-white/10">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = route === item.id || (route === 'practice' && item.id === 'explore');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm shadow-indigo-500/15'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={() => navigateTo('dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-400/40 text-amber-700 dark:text-amber-300 text-xs font-extrabold hover:scale-105 transition cursor-pointer"
                title="Chuỗi ngày học liên tiếp"
              >
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span>{user.streak_count || 0}</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-white/[0.07] border border-slate-200/70 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-amber-300 transition cursor-pointer"
              title="Đổi giao diện Sáng / Tối"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <div className="flex items-center gap-2 pl-2 ml-0.5 border-l border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => navigateTo('dashboard')}
                  className="flex items-center gap-2 rounded-full pr-2.5 pl-1 py-1 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
                  title="Xem hồ sơ & thống kê"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-sm">
                    {getInitials(user.name)}
                  </span>
                  <span className="hidden sm:inline text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[115px] truncate">
                    {user.name}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-up ${
          showMobileDock ? 'pb-24 lg:pb-10' : 'pb-10'
        }`}
      >
        {route === 'explore' && (
          <ExplorePage onSelectLesson={openLesson} onGoCreate={() => navigateTo('create')} />
        )}
        {route === 'practice' && activeLessonId !== null && (
          <PracticePage
            lessonId={activeLessonId}
            onBack={() => navigateTo('explore')}
            onOpenMistakes={() => navigateTo('mistakes')}
          />
        )}
        {route === 'create' && <CreateLessonPage onCreated={openLesson} />}
        {route === 'vocab' && <VocabPage />}
        {route === 'mistakes' && <MistakesPage onOpenLesson={openLesson} />}
        {route === 'dashboard' && (
          <DashboardPage
            onOpenLesson={openLesson}
            onOpenMistakes={() => navigateTo('mistakes')}
            onOpenVocab={() => navigateTo('vocab')}
          />
        )}
      </main>

      {/* Desktop Footer */}
      <footer className="hidden lg:block border-t border-slate-200/70 dark:border-white/10 py-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            DictaFlow — Nền tảng Luyện Nghe Chép Chính Tả Tiếng Anh qua Video
          </span>
          <span>Phong cách Parroto • Đồng bộ song ngữ Anh–Việt</span>
        </div>
      </footer>

      {/* Native-Style Mobile Glass Bottom Dock */}
      {showMobileDock && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-1 pointer-events-none">
          <div className="pointer-events-auto max-w-md mx-auto grid grid-cols-5 gap-1 p-1.5 rounded-2xl bg-white/90 dark:bg-[#0e1527]/92 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-[0_8px_32px_rgba(15,23,42,0.22)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-full">{item.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
