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

function AppShell() {
  const { user, theme, toggleTheme, setAuthModalOpen, logout } = useAuth();
  const [route, setRoute] = useState<PageRoute>('explore');
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);

  const openLesson = (id: number) => {
    setActiveLessonId(id);
    setRoute('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems: { id: PageRoute; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'explore', label: 'Khám phá', icon: Compass },
    { id: 'create', label: 'Tạo bài học', icon: PlusCircle },
    { id: 'vocab', label: 'Từ vựng & Flashcard', icon: BookMarked },
    { id: 'mistakes', label: 'Câu hay sai', icon: AlertTriangle },
    { id: 'dashboard', label: 'Thống kê', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setRoute('explore')}
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm">
              <Headphones className="w-5 h-5" />
            </div>
            <div className="text-left hidden sm:block">
              <div className="font-extrabold text-base tracking-tight leading-none">DictaFlow</div>
              <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                Luyện Nghe Chép Chính Tả
              </div>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = route === item.id || (route === 'practice' && item.id === 'explore');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRoute(item.id)}
                  className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={() => setRoute('dashboard')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-extrabold cursor-pointer"
                title="Chuỗi ngày học liên tiếp"
              >
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                {user.streak_count || 0}
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Đổi giao diện Sáng/Tối"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <span className="hidden sm:inline text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                  {user.name}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <LogIn className="w-4 h-4" /> Đăng nhập
              </button>
            )}
          </div>
        </div>

        {/* Mobile / Tablet Scroll Nav */}
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = route === item.id || (route === 'practice' && item.id === 'explore');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRoute(item.id)}
                className={`whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {route === 'explore' && (
          <ExplorePage onSelectLesson={openLesson} onGoCreate={() => setRoute('create')} />
        )}
        {route === 'practice' && activeLessonId !== null && (
          <PracticePage
            lessonId={activeLessonId}
            onBack={() => setRoute('explore')}
            onOpenMistakes={() => setRoute('mistakes')}
          />
        )}
        {route === 'create' && <CreateLessonPage onCreated={openLesson} />}
        {route === 'vocab' && <VocabPage />}
        {route === 'mistakes' && <MistakesPage onOpenLesson={openLesson} />}
        {route === 'dashboard' && (
          <DashboardPage
            onOpenLesson={openLesson}
            onOpenMistakes={() => setRoute('mistakes')}
            onOpenVocab={() => setRoute('vocab')}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-5 text-center text-xs text-slate-400">
        DictaFlow — Nền tảng Luyện Nghe Chép Chính Tả Tiếng Anh qua Video & AI Studio
      </footer>

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
