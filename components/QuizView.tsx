'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Award, HelpCircle, CheckCircle2, XCircle, Sparkles, Heart, Play, PlayCircle, RotateCcw, Pause, BookmarkCheck, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import SafeImage from '@/components/SafeImage';
import { Ministry, Quiz, QuizType, QuizSession } from '@/lib/types';
import { getSavedSession, saveSession, clearSession } from '@/lib/quiz-session';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { CategorySection } from '@/components/WebDocumentView';
import { useFirebase } from '@/lib/FirebaseProvider';

interface QuizViewProps {
  ministry: Ministry;
  category: string;
  quizType: QuizType;
  onBack: () => void;
  onComplete: (score: number) => void;
  initialResume?: boolean;
}

export const QuizView: React.FC<QuizViewProps> = ({ ministry, category, quizType, onBack, onComplete, initialResume = false }) => {
  const { toggleFavorite, favorites } = useFirebase();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [isFinished, setIsFinished] = useState(false);
  const [showIntermediateResult, setShowIntermediateResult] = useState(false);
  const [savedSessionPrompt, setSavedSessionPrompt] = useState<QuizSession | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [shuffledOptions, setShuffledOptions] = useState<{ originalKey: string; value: string }[]>([]);

  React.useEffect(() => {
    const filtered = (ministry.quizzes || []).filter(q => q.category === category && (q.type || 'MULTIPLE_CHOICE') === quizType);
    const saved = getSavedSession(ministry.id, quizType, category);

    // If there is an unfinished saved session
    if (saved && !saved.isFinished && (saved.currentIdx > 0 || Object.keys(saved.answers || {}).length > 0) && Array.isArray(saved.quizzes) && saved.quizzes.length > 0) {
      if (initialResume) {
        // Automatically resume without prompt
        setQuizzes(saved.quizzes);
        setCurrentIdx(Math.min(saved.currentIdx || 0, saved.quizzes.length - 1));
        setSelectedOption(saved.selectedOption || null);
        setShowExplanation(saved.showExplanation || false);
        setRevealed(saved.revealed || false);
        setAnswers(saved.answers || {});
        setIsFinished(false);
        setShowIntermediateResult(false);
        setSavedSessionPrompt(null);
        setIsLoading(false);
        return;
      } else {
        // Show prompt asking to resume or restart
        setSavedSessionPrompt(saved);
        const shuffled = [...filtered].sort(() => Math.random() - 0.5);
        setQuizzes(shuffled);
        setIsLoading(false);
        return;
      }
    }

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    const timer = setTimeout(() => {
      setQuizzes(shuffled);
      setCurrentIdx(0);
      setSelectedOption(null);
      setShowExplanation(false);
      setRevealed(false);
      setAnswers({});
      setIsFinished(false);
      setShowIntermediateResult(false);
      setSavedSessionPrompt(null);
      setIsLoading(false);
    }, 0);
    
    return () => clearTimeout(timer);
  }, [category, quizType, ministry, initialResume]);

  const resumeTest = () => {
    if (!savedSessionPrompt) return;
    setQuizzes(savedSessionPrompt.quizzes);
    setCurrentIdx(Math.min(savedSessionPrompt.currentIdx || 0, savedSessionPrompt.quizzes.length - 1));
    setSelectedOption(savedSessionPrompt.selectedOption || null);
    setShowExplanation(savedSessionPrompt.showExplanation || false);
    setRevealed(savedSessionPrompt.revealed || false);
    setAnswers(savedSessionPrompt.answers || {});
    setIsFinished(false);
    setShowIntermediateResult(false);
    setSavedSessionPrompt(null);
  };

  const restartTest = () => {
    clearSession(ministry.id, quizType, category);
    setSavedSessionPrompt(null);
    const filtered = (ministry.quizzes || []).filter(q => q.category === category && (q.type || 'MULTIPLE_CHOICE') === quizType);
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    setQuizzes(shuffled);
    setCurrentIdx(0);
    setSelectedOption(null);
    setShowExplanation(false);
    setRevealed(false);
    setAnswers({});
    setIsFinished(false);
    setShowIntermediateResult(false);
  };

  // Helper to persist current progress
  const persistProgress = (
    targetQuizzes: Quiz[], 
    targetIdx: number, 
    targetAnswers: { [key: string]: string }, 
    targetSelected: string | null, 
    targetShowExp: boolean, 
    targetRevealed: boolean,
    finished: boolean = false
  ) => {
    if (finished) {
      clearSession(ministry.id, quizType, category);
      return;
    }
    if (!targetQuizzes || targetQuizzes.length === 0) return;
    saveSession({
      ministryId: ministry.id,
      ministryName: ministry.khmerName || ministry.name,
      category,
      quizType,
      quizzes: targetQuizzes,
      currentIdx: targetIdx,
      answers: targetAnswers,
      selectedOption: targetSelected,
      showExplanation: targetShowExp,
      revealed: targetRevealed,
      updatedAt: Date.now(),
      isFinished: false
    });
  };

  const currentQuiz = quizzes[currentIdx];

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (quizType === 'MULTIPLE_CHOICE' && currentQuiz && currentQuiz.options) {
      const entries = Object.entries(currentQuiz.options);
      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      const mapped = shuffled.map(([originalKey, value]) => ({ originalKey, value }));
      timer = setTimeout(() => {
        setShuffledOptions(mapped);
      }, 0);
    } else {
      timer = setTimeout(() => {
        setShuffledOptions([]);
      }, 0);
    }
    return () => clearTimeout(timer);
  }, [currentQuiz, quizType]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full"
        />
        <p className="text-sm font-medium text-[#1B365D]/60 font-khmer">កំពុងរៀបចំសំណួរ...</p>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="text-center py-24 space-y-6 max-w-sm mx-auto">
        <p className="text-lg text-[#1A1A1A]/70 font-khmer">មិនមានសំណួរសម្រាប់វិញ្ញាសានេះទេ។</p>
        <Button onClick={onBack} className="font-khmer bg-[#1B365D] text-white hover:bg-[#1B365D]/90 h-12 px-6 rounded-xl">
          ត្រឡប់ក្រោយ
        </Button>
      </div>
    );
  }

  if (quizType === 'Q_AND_A' || quizType === 'VOCABULARY') {
    return (
      <div className="max-w-4xl mx-auto pb-24 space-y-6 animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            onClick={onBack} 
            className="group gap-2 md:gap-3 text-[10px] md:text-[10px] uppercase tracking-widest font-bold rounded-xl px-2 md:px-4"
            style={{ color: 'rgba(27, 54, 93, 0.6)', backgroundColor: 'rgba(27, 54, 93, 0.05)' }}
          >
            <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> ត្រឡប់
          </Button>
        </div>
        <CategorySection category={category} items={quizzes} defaultExpanded={true} />
      </div>
    );
  }

  const optionLabels: { [key: string]: string } = {
    "A": "ក", "B": "ខ", "C": "គ", "D": "ឃ"
  };

  const handleSelect = (option: string) => {
    if (showExplanation) return;
    const newAnswers = { ...answers, [currentQuiz.id]: option };
    setSelectedOption(option);
    setAnswers(newAnswers);
    setShowExplanation(true);
    persistProgress(quizzes, currentIdx, newAnswers, option, true, revealed, false);
  };

  const handleReveal = () => {
    setRevealed(true);
    setShowExplanation(true);
    persistProgress(quizzes, currentIdx, answers, selectedOption, true, true, false);
  };

  const proceedToNext = () => {
    const nextIdx = currentIdx + 1;
    setCurrentIdx(nextIdx);
    setSelectedOption(null);
    setShowExplanation(false);
    setRevealed(false);
    persistProgress(quizzes, nextIdx, answers, null, false, false, false);
  };

  const handleSafeBack = () => {
    if (!isFinished && quizzes.length > 0) {
      persistProgress(quizzes, currentIdx, answers, selectedOption, showExplanation, revealed, false);
    }
    onBack();
  };

  const handlePauseAndExit = () => {
    persistProgress(quizzes, currentIdx, answers, selectedOption, showExplanation, revealed, false);
    setToastMessage("បានរក្សាទុកវឌ្ឍនភាពរបស់អ្នកជោគជ័យ! អ្នកអាចត្រឡប់មកបន្តបានគ្រប់ពេល។");
    setTimeout(() => {
      onBack();
    }, 400);
  };

  const handleNext = () => {
    if (showIntermediateResult) {
      setShowIntermediateResult(false);
      proceedToNext();
      return;
    }

    if (currentIdx < quizzes.length - 1) {
      if ((currentIdx + 1) % 10 === 0) {
        setShowIntermediateResult(true);
      } else {
        proceedToNext();
      }
    } else {
      setIsFinished(true);
      clearSession(ministry.id, quizType, category);
      const score = quizzes.reduce((acc, q) => {
        if (quizType === 'MULTIPLE_CHOICE') {
          return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
        }
        return acc + 1; // For Q&A and Vocabulary, we count completion for now
      }, 0);
      onComplete(score);
      if (score === quizzes.length) {
        import('canvas-confetti').then((module) => {
          const confetti = module.default;
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
          });
        }).catch((err) => console.error("Confetti error:", err));
      }
    }
  };

  const scoreCount = quizzes.reduce((acc, q) => {
    return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
  }, 0);

  if (isFinished || showIntermediateResult) {
    const isIntermediate = showIntermediateResult && !isFinished;
    const currentChunkStartIndex = Math.floor(currentIdx / 10) * 10;
    const currentChunkEndIndex = currentIdx;
    const chunkQuizzes = quizzes.slice(currentChunkStartIndex, currentChunkEndIndex + 1);
    
    // For QA and Vocab, score count might not mean "correctness" the same way, but it works for MCQ.
    const chunkScoreCount = chunkQuizzes.reduce((acc, q) => {
      return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
    }, 0);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto py-8 md:py-12 px-4"
      >
        <Card className="text-center rounded-[2rem] md:rounded-[2.5rem] border-none shadow-[0_20px_60px_rgba(27,54,93,0.1)] bg-white p-8 md:p-12 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 prestige-gradient" />
          <CardHeader>
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-xl border border-[#1B365D]/5 relative overflow-hidden p-3"
            >
              {ministry.logo ? (
                <SafeImage 
                  src={ministry.logo} 
                  alt={ministry.name} 
                  fill
                  className="object-contain p-3"
                />
              ) : (
                <Award className="w-10 h-10 md:w-12 md:h-12 text-[#D4AF37]" />
              )}
            </motion.div>
            <CardTitle className="text-3xl md:text-4xl font-bold text-[#1B365D] font-serif">
              {isIntermediate ? 'អបអរសាទរ!' : 'អបអរសាទរ!'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 md:space-y-10">
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1B365D]/40">
                {isIntermediate ? 'លទ្ធផល ១០ សំណួរនេះ' : 'លទ្ធផលសរុបរបស់អ្នក'}
              </p>
              <div className="text-6xl md:text-8xl font-bold prestige-text-gradient">
                {isIntermediate ? chunkScoreCount : scoreCount} <span className="text-xl md:text-2xl text-[#1B365D]/20">/ {isIntermediate ? chunkQuizzes.length : quizzes.length}</span>
              </div>
            </div>
            <p className="text-sm md:text-base text-[#1A1A1A]/60 leading-relaxed max-w-sm mx-auto">
              {isIntermediate ? (
                <>អ្នកបានឆ្លងកាត់ការរៀនវិញ្ញាសា <span className="text-[#1B365D] font-bold">&quot;{category}&quot;</span> ជាបន្តបន្ទាប់។ បន្តទៅសំណួរបន្ទាប់ទៀត!</>
              ) : (
                <>អ្នកបានបញ្ចប់ការរៀនវិញ្ញាសា <span className="text-[#1B365D] font-bold">&quot;{category}&quot;</span> សម្រាប់ {ministry.name} ដោយជោគជ័យ។</>
              )}
            </p>
          </CardContent>
          <CardFooter className="pt-6 md:pt-8">
            {isIntermediate ? (
              <Button 
                className="w-full h-14 md:h-16 rounded-xl md:rounded-2xl prestige-gradient hover:shadow-lg hover:shadow-[#1B365D]/20 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all" 
                onClick={handleNext}
              >
                បន្តទៅមុខទៀត
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button 
                  variant="outline"
                  className="flex-1 h-12 sm:h-14 rounded-xl md:rounded-2xl border-2 border-[#1B365D]/20 text-[#1B365D] hover:bg-[#1B365D]/5 text-xs font-bold uppercase tracking-wider transition-all gap-2"
                  onClick={restartTest}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>ធ្វើតេស្តឡើងវិញ</span>
                </Button>
                <Button 
                  className="flex-1 h-12 sm:h-14 rounded-xl md:rounded-2xl prestige-gradient hover:shadow-lg hover:shadow-[#1B365D]/20 text-xs font-bold uppercase tracking-widest transition-all" 
                  onClick={onBack}
                >
                  ត្រឡប់ទៅវិញ្ញាសា
                </Button>
              </div>
            )}
          </CardFooter>
        </Card>
      </motion.div>
    );
  }

  return (
    <div id="quiz-container" className="max-w-4xl mx-auto space-y-8 md:space-y-12 pb-24 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#094C72] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-khmer border border-amber-400/40"
          >
            <BookmarkCheck className="w-4 h-4 text-amber-300" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume Test Prompt Modal */}
      {savedSessionPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border-2 border-amber-400/40 relative overflow-hidden"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <PlayCircle className="w-9 h-9 fill-amber-500/20 text-amber-600" />
            </div>
            <div className="text-center space-y-2 mb-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                រកឃើញវិញ្ញាសាមិនទាន់ចប់ • RESUME TEST
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-khmer pt-1">
                តើអ្នកចង់បន្តធ្វើតេស្ត?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-khmer leading-relaxed">
                អ្នកមានវិញ្ញាសាកំពុងធ្វើមិនទាន់ចប់ ៖ <span className="font-bold text-[#094C72]">សំណួរទី {(savedSessionPrompt.currentIdx || 0) + 1}</span> នៃ {savedSessionPrompt.quizzes?.length || 0} (ឆ្លើយបាន {Object.keys(savedSessionPrompt.answers || {}).length} សំណួរ)
              </p>
            </div>

            <div className="space-y-2.5">
              <Button
                onClick={resumeTest}
                className="w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#094C72] to-[#1565C0] hover:from-[#073854] hover:to-[#0d47a1] text-white font-khmer font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current text-amber-300" />
                <span>បន្តធ្វើតេស្ត (Resume Test)</span>
              </Button>
              <Button
                variant="outline"
                onClick={restartTest}
                className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-khmer font-semibold text-xs flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ចាប់ផ្ដើមឡើងវិញពីសំណួរទី ១ (Restart)</span>
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Quiz Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 pt-1 sm:pt-2 pb-2">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button 
            variant="ghost" 
            onClick={handleSafeBack} 
            className="group gap-1 sm:gap-1.5 text-xs font-bold rounded-xl px-2.5 sm:px-3.5 py-2 font-khmer shadow-2xs hover:bg-slate-100"
            style={{ color: '#094C72', backgroundColor: 'rgba(9, 76, 114, 0.08)' }}
          >
            <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
            <span>ត្រឡប់</span>
          </Button>

          <Button
            variant="ghost"
            onClick={handlePauseAndExit}
            className="gap-1.5 text-xs font-bold font-khmer rounded-xl px-2.5 sm:px-3 py-2 bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/80 shadow-2xs"
            title="ផ្អាក និង រក្សាទុកវិញ្ញាសា (Pause & Save)"
          >
            <Pause className="w-3.5 h-3.5 fill-current text-blue-600" />
            <span className="hidden xs:inline">ផ្អាក & រក្សាទុក</span>
            <span className="xs:hidden">ផ្អាក</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-end min-w-0">
          {/* Favorite Lesson Button */}
          <button
            type="button"
            onClick={() => {
              const lessonKey = `lesson_${ministry.id}_${encodeURIComponent(category)}`;
              toggleFavorite(lessonKey);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold font-khmer transition-all border shrink-0 cursor-pointer",
              favorites.includes(`lesson_${ministry.id}_${encodeURIComponent(category)}`)
                ? "bg-rose-50 text-rose-600 border-rose-300 shadow-2xs"
                : "bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200 border-slate-200 shadow-2xs"
            )}
            title={favorites.includes(`lesson_${ministry.id}_${encodeURIComponent(category)}`) ? "ដកមេរៀននេះពីបញ្ជីចូលចិត្ត" : "រក្សាទុកមេរៀននេះក្នុងបញ្ជីចូលចិត្ត"}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">ចូលចិត្តមេរៀន</span>
            <Heart className={cn("w-3.5 h-3.5", favorites.includes(`lesson_${ministry.id}_${encodeURIComponent(category)}`) ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
          </button>

          {/* Favorite Question Button */}
          <button 
            type="button"
            onClick={() => toggleFavorite(currentQuiz.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold font-khmer transition-all border shrink-0 cursor-pointer",
              favorites.includes(currentQuiz.id)
                ? "bg-rose-50 text-rose-600 border-rose-300 shadow-2xs"
                : "bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200 border-slate-200 shadow-2xs"
            )}
            title={favorites.includes(currentQuiz.id) ? "ដកសំណួរនេះពីបញ្ជីចូលចិត្ត" : "រក្សាទុកសំណួរនេះក្នុងបញ្ជីចូលចិត្ត"}
          >
            <Heart className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", favorites.includes(currentQuiz.id) ? "fill-rose-500 text-rose-500" : "text-slate-400")} />
            <span className="hidden sm:inline">សំណួរចូលចិត្ត</span>
          </button>

          {/* Category Pill */}
          <div className="px-3 sm:px-4 py-1.5 bg-white rounded-full border border-slate-200 shadow-2xs truncate max-w-[130px] sm:max-w-[200px] md:max-w-none">
            <span className="text-[10px] sm:text-xs font-bold text-[#D4AF37] truncate block font-khmer">
              {category}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-start gap-6 sm:gap-8 md:gap-12">
        {/* Question Area */}
        <div className="flex-grow space-y-6 sm:space-y-8 md:space-y-10 w-full order-2 lg:order-1">
          <div className="space-y-3 sm:space-y-4">
            <div className="inline-flex items-center gap-2 sm:gap-3">
              <span className="w-6 sm:w-8 h-[2px] bg-[#D4AF37]" />
              <span 
                className="text-[#D4AF37] font-bold uppercase tracking-wider text-xs font-khmer whitespace-nowrap"
              >
                សំណួរទី {currentIdx + 1} នៃ {quizzes.length}
              </span>
            </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-4 sm:mb-6">
                <div 
                  className="bg-[#D4AF37] h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((currentIdx + 1) / quizzes.length) * 100}%` }}
                />
              </div>
            <h2 className="text-xl sm:text-2xl md:text-4xl font-bold leading-[1.3] md:leading-[1.2] text-[#f8004c] whitespace-pre-wrap break-words-khmer">
              {currentQuiz.question}
            </h2>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuiz.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {quizType === 'MULTIPLE_CHOICE' ? (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-5">
                  {shuffledOptions.map((item, index) => {
                    const key = item.originalKey;
                    const value = item.value;
                    const isSelected = selectedOption === key;
                    const isCorrect = showExplanation && key === currentQuiz.correctAnswer;
                    const isWrong = showExplanation && isSelected && key !== currentQuiz.correctAnswer;
                    
                    const slotKey = ["A", "B", "C", "D"][index] || "A";
                    const label = optionLabels[slotKey] || slotKey;

                    return (
                      <motion.button
                        whileHover={!showExplanation ? { scale: 1.015, y: -2 } : { scale: 1 }}
                        whileTap={!showExplanation ? { scale: 0.98 } : { scale: 1 }}
                        animate={
                          isSelected && isCorrect
                            ? { scale: [1, 1.04, 0.98, 1.01, 1], y: [0, -8, 2, -1, 0] }
                            : isSelected && isWrong
                            ? { x: [0, -12, 10, -8, 6, -4, 2, 0] }
                            : {}
                        }
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 15,
                          duration: 0.6
                        }}
                        key={key}
                        disabled={showExplanation}
                        onClick={() => handleSelect(key)}
                        className={cn(
                          "group relative flex items-center gap-3 sm:gap-4 md:gap-5 p-3.5 sm:p-5 md:p-6 border-2 rounded-2xl md:rounded-[1.5rem] transition-all duration-500 text-left w-full overflow-hidden hover:z-10",
                          !showExplanation && "bg-white border-slate-200 hover:border-[#D4AF37] hover:shadow-[0_8px_30px_rgb(212,175,55,0.15)] hover:bg-gradient-to-br hover:from-white hover:to-[#FCF9F2]",
                          isSelected && !showExplanation && "border-[#D4AF37] bg-gradient-to-br from-white to-[#FCF9F2] ring-4 ring-[#D4AF37]/10 z-10",
                          isCorrect && "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-500/20 z-10",
                          isWrong && "border-rose-500 bg-rose-50 ring-4 ring-rose-500/20 z-10",
                          showExplanation && !isCorrect && !isWrong && "border-slate-100 opacity-60 bg-slate-50/50 grayscale-[0.5]"
                        )}
                        style={{
                          boxShadow: !showExplanation && isSelected ? '0 10px 40px -10px rgba(212,175,55,0.3)' : undefined,
                        }}
                      >
                        <div className={cn(
                          "flex-shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 font-bold text-xs sm:text-sm md:text-base transition-all duration-500 shadow-sm z-10",
                          !showExplanation && isSelected ? "bg-[#D4AF37] text-white border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)] scale-110" : "bg-white text-slate-400 border-slate-200 group-hover:border-[#D4AF37] group-hover:text-[#D4AF37] group-hover:bg-[#FCF9F2]",
                          isCorrect && "bg-emerald-500 text-white border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-110",
                          isWrong && "bg-rose-500 text-white border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] scale-110",
                          showExplanation && !isCorrect && !isWrong && "bg-slate-100 text-slate-300 border-slate-200"
                        )}>
                          {isCorrect ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : isWrong ? <XCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : label}
                        </div>
                        <span className={cn(
                          "flex-grow text-sm sm:text-base md:text-lg font-medium transition-colors relative z-10 break-words-khmer",
                          isSelected || isCorrect || isWrong ? "text-slate-900 font-bold" : "text-slate-600 group-hover:text-slate-900"
                        )}
                        style={{ fontFamily: 'var(--font-khmer)' }}
                        >
                          {value}
                        </span>
                        
                        {/* Right side animated status badges */}
                        {showExplanation && (
                          <div className="relative z-15 shrink-0 ml-1 sm:ml-2">
                            {isSelected && isCorrect && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0, rotate: -15 }}
                                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 350, damping: 12, delay: 0.15 }}
                                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-500 text-white text-[10px] sm:text-xs font-bold font-khmer shadow-md shadow-emerald-500/20 border border-emerald-400 whitespace-nowrap"
                              >
                                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-bounce" />
                                <span>ត្រឹមត្រូវ! 🎉</span>
                              </motion.div>
                            )}
                            {isSelected && isWrong && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0, rotate: 15 }}
                                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                transition={{ type: "spring", stiffness: 350, damping: 12, delay: 0.15 }}
                                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-rose-500 text-white text-[10px] sm:text-xs font-bold font-khmer shadow-md shadow-rose-500/20 border border-rose-400 whitespace-nowrap"
                              >
                                <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" />
                                <span>ខុសហើយ! ❌</span>
                              </motion.div>
                            )}
                            {isCorrect && !isSelected && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.95 }}
                                transition={{ duration: 0.3, delay: 0.2 }}
                                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-850 text-[10px] sm:text-xs font-medium font-khmer border border-emerald-200 whitespace-nowrap"
                              >
                                <span>ចម្លើយត្រឹមត្រូវ</span>
                              </motion.div>
                            )}
                          </div>
                        )}

                        {/* Sparkle burst decoration for correct chosen option */}
                        {isSelected && isCorrect && (
                          <>
                            <motion.div
                              initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                              animate={{ scale: [0, 1.25, 0], opacity: [0, 1, 0], x: [-35, -75], y: [-15, -45] }}
                              transition={{ duration: 1.2, ease: "easeOut" }}
                              className="absolute right-12 top-2 text-yellow-500 pointer-events-none z-20"
                            >
                              <Sparkles className="w-5 h-5 fill-yellow-400" />
                            </motion.div>
                            <motion.div
                              initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                              animate={{ scale: [0, 1.25, 0], opacity: [0, 1, 0], x: [15, 60], y: [15, 45] }}
                              transition={{ duration: 1.3, ease: "easeOut", delay: 0.05 }}
                              className="absolute right-24 bottom-2 text-emerald-400 pointer-events-none z-20"
                            >
                              <Sparkles className="w-4 h-4 fill-emerald-300" />
                            </motion.div>
                            <motion.div
                              initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                              animate={{ scale: [0, 1, 0], opacity: [0, 0.85, 0], x: [-25, -50], y: [15, 30] }}
                              transition={{ duration: 1.0, ease: "easeOut", delay: 0.1 }}
                              className="absolute left-1/3 top-1 text-sky-400 pointer-events-none z-20"
                            >
                              <Sparkles className="w-4 h-4 fill-sky-300" />
                            </motion.div>
                          </>
                        )}
                        
                        {isCorrect && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-green-500/5 rounded-2xl md:rounded-[1.5rem]" />
                        )}
                        {isWrong && (
                          <div 
                            className="absolute inset-0 bg-gradient-to-r from-transparent to-red-500/5 rounded-2xl md:rounded-[1.5rem]" 
                            style={{ backgroundColor: '#ecdada' }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-6 md:space-y-8">
                  {!revealed ? (
                    <Button 
                      onClick={handleReveal}
                      className="w-full h-24 md:h-32 rounded-[1.5rem] md:rounded-[2.5rem] bg-white border-2 border-dashed border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/5 hover:border-[#D4AF37] transition-all group px-4"
                    >
                      <div className="flex flex-col items-center gap-2 md:gap-3">
                        <HelpCircle className="w-6 h-6 md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
                        <span className="font-bold uppercase tracking-widest text-[9px] md:text-xs">ចុចដើម្បីមើលចម្លើយត្រឹមត្រូវ</span>
                      </div>
                    </Button>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-8 md:p-10 rounded-2xl md:rounded-[2.5rem] bg-white border-2 border-green-500/20 shadow-lg shadow-green-500/5"
                    >
                      <div className="flex items-center gap-4 mb-4 md:mb-6">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-green-500 rounded-xl md:rounded-2xl flex items-center justify-center text-white">
                          <Award className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <h3 className="font-bold text-green-600 uppercase tracking-widest text-[10px] md:text-xs">ចម្លើយត្រឹមត្រូវ</h3>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-[#1B365D] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'var(--font-khmer)' }}>
                        {currentQuiz.answer || currentQuiz.correctAnswer}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}

              {showExplanation && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 md:space-y-6"
                >
                  {currentQuiz.explanation && (
                    <div className="p-6 md:p-8 rounded-2xl md:rounded-[2rem] bg-white border border-[#D4AF37]/20 shadow-lg shadow-[#D4AF37]/5 flex flex-col md:flex-row gap-4 md:gap-6">
                      <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-[#D4AF37]/10 rounded-xl md:rounded-2xl flex items-center justify-center text-[#D4AF37]">
                        <HelpCircle className="w-5 h-5 md:w-6 md:h-6" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">ឯកសារយោង / ពន្យល់</h3>
                        <p className="text-sm md:text-base leading-relaxed text-[#1A1A1A]/80 italic font-medium whitespace-pre-wrap">
                          {currentQuiz.explanation?.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part: string, i: number) => 
                            part.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/g) ? (
                              <a key={i} href={part.startsWith('www.') ? `https://${part}` : part} target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:text-[#B3932F] underline break-all not-italic font-bold relative z-10 pointer-events-auto">
                                {part}
                              </a>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-4 md:pt-6">
                    <Button 
                      onClick={handleNext}
                      className="h-14 md:h-16 px-8 md:px-12 rounded-xl md:rounded-2xl prestige-gradient hover:shadow-xl hover:shadow-[#1B365D]/20 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all gap-2 md:gap-3 w-full sm:w-auto"
                    >
                      {currentIdx < quizzes.length - 1 ? 'សំណួរបន្ទាប់' : 'មើលលទ្ធផល'} <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
