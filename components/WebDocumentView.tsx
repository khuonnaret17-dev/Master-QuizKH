import React, { useState } from 'react';
import { Ministry, Quiz, PdfDocument } from '@/lib/types';
import { HelpCircle, MessageSquare, Globe, AlertCircle, ChevronDown, ChevronUp, FileText, Download, Heart } from 'lucide-react';
import { useFirebase } from '@/lib/FirebaseProvider';

interface WebDocumentViewProps {
  ministry: Ministry;
  documents?: PdfDocument[];
}

export const CategorySection = ({ category, items, defaultExpanded = false }: { category: string, items: Quiz[], defaultExpanded?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { favorites, toggleFavorite } = useFirebase();
  const lessonKey = `lesson_${encodeURIComponent(category)}`;
  const isLessonFavorited = favorites.includes(lessonKey);

  return (
    <div className="space-y-4 bg-white/20 p-2 rounded-2xl">
      <div className="w-full flex items-center justify-between px-3.5 sm:px-5 py-3 sm:py-4 bg-white/70 shadow-sm border border-slate-100 rounded-xl hover:bg-white transition-colors gap-2">
        <button 
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0 text-left cursor-pointer"
        >
          <span className="text-base sm:text-lg font-bold text-slate-800 truncate font-khmer">
            ផ្នែក៖ {category}
          </span>
          <span className="bg-amber-100 text-amber-800 text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 rounded-lg shrink-0 font-khmer">
            {items.length} ឯកសារ
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(lessonKey);
            }}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isLessonFavorited 
                ? 'text-rose-500 bg-rose-50 ring-1 ring-rose-200' 
                : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100'
            }`}
            title={isLessonFavorited ? 'ដកមេរៀនពីបញ្ជីចូលចិត្ត' : 'រក្សាទុកមេរៀននេះ'}
          >
            <Heart className={`w-4 h-4 ${isLessonFavorited ? 'fill-current text-rose-500' : ''}`} />
          </button>
          <button 
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="space-y-6 sm:space-y-8 pl-2 sm:pl-4 lg:pl-8 border-l-2 border-amber-200/50 mt-4 sm:mt-6 animate-in fade-in slide-in-from-top-2">
          {items.map((item, idx) => {
            const isFav = favorites.includes(item.id);
            return (
              <div key={item.id} className="space-y-3 bg-white/40 p-3.5 sm:p-6 rounded-2xl border border-white/50 shadow-sm overflow-hidden">
                <div className="flex items-start gap-2.5 sm:gap-4">
                  <span className="font-bold text-[#1B365D] mt-0.5 bg-white w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full shadow-sm shrink-0 text-xs sm:text-sm">{idx + 1}</span>
                  <div className="space-y-3 sm:space-y-4 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed font-khmer whitespace-pre-wrap break-words-khmer flex-1">
                        {item.question}
                      </h4>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(item.id)}
                        className={`p-2 rounded-full transition-all shrink-0 cursor-pointer ${
                          isFav 
                            ? 'text-rose-500 bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-200 shadow-2xs' 
                            : 'text-slate-300 hover:text-rose-500 hover:bg-white'
                        }`}
                        title={isFav ? 'ដកសំណួរពីបញ្ជីចូលចិត្ត' : 'រក្សាទុកសំណួរក្នុងបញ្ជីចូលចិត្ត'}
                      >
                        <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${isFav ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    
                    {/* Options for MCQ */}
                    {item.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1 sm:pt-2">
                        {Object.entries(item.options).map(([key, value]) => {
                          const isCorrect = key === item.correctAnswer;
                          return (
                            <div 
                              key={key} 
                              className={`flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl border ${
                                isCorrect ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'
                              }`}
                            >
                              <span className={`font-bold shrink-0 ${isCorrect ? 'text-green-600' : 'text-slate-500'}`}>
                                {key.toUpperCase()}.
                              </span>
                              <span className={`${isCorrect ? 'text-green-800 font-medium' : 'text-slate-600'} whitespace-pre-wrap break-words-khmer text-xs sm:text-sm`}>
                                {value as React.ReactNode}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Answer for Q&A */}
                    {item.answer && (
                      <div className="bg-blue-50/70 rounded-xl p-3.5 sm:p-5 border border-blue-100/50 mt-2">
                        <p className="text-slate-800 leading-relaxed font-khmer whitespace-pre-wrap break-words-khmer text-xs sm:text-sm">
                          <span className="font-bold text-blue-800 mr-2 block mb-1">ចម្លើយ៖</span>
                          {item.answer?.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part: string, i: number) => 
                            part.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/g) ? (
                              <a key={i} href={part.startsWith('www.') ? `https://${part}` : part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline break-all relative z-10 pointer-events-auto">
                                {part}
                              </a>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </p>
                      </div>
                    )}

                    {/* Explanation */}
                    {item.explanation && (
                      <div className="mt-4 p-4 md:p-6 rounded-2xl bg-white/90 border border-[#D4AF37]/20 shadow-sm flex flex-col md:flex-row gap-3 md:gap-4">
                        <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 bg-[#D4AF37]/10 rounded-xl flex items-center justify-center text-[#D4AF37]">
                          <HelpCircle className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="space-y-1 md:space-y-2">
                          <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">ឯកសារយោង / ពន្យល់</h3>
                          <p className="text-sm leading-relaxed text-[#1A1A1A]/80 italic font-medium whitespace-pre-wrap">
                            {item.explanation?.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part: string, i: number) => 
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const WebDocumentView: React.FC<WebDocumentViewProps> = ({ ministry, documents = [] }) => {
  const quizzes = ministry.quizzes || [];
  const [activeType, setActiveType] = useState<string | null>(null);
  const { favorites, toggleFavorite } = useFirebase();

  if (quizzes.length === 0 && documents.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">មិនមានឯកសារ</h3>
        <p className="text-slate-500 text-sm">មិនទាន់មានសំណួរនិងចម្លើយដែលបានបញ្ចូលទៅក្នុងប្រព័ន្ធនៅឡើយទេ។</p>
      </div>
    );
  }

  // Group by type and category
  const grouped = quizzes.reduce((acc, quiz) => {
    const typeLabel = quiz.type === 'MULTIPLE_CHOICE' ? 'សំណួរពហុចម្លើយ' 
                    : quiz.type === 'Q_AND_A' ? 'សំណួរចម្លើយ' 
                    : quiz.type === 'VOCABULARY' ? 'ពន្យល់ពាក្យ' 
                    : 'ទូទៅ';
    
    if (!acc[typeLabel]) acc[typeLabel] = {};
    if (!acc[typeLabel][quiz.category]) acc[typeLabel][quiz.category] = [];
    acc[typeLabel][quiz.category].push(quiz);
    return acc;
  }, {} as Record<string, Record<string, Quiz[]>>);

  const typeKeys = Object.keys(grouped);
  if (documents.length > 0) {
    typeKeys.push('ឯកសារយោង (PDF)');
  }
  
  // Set initial active type if null
  if (!activeType && typeKeys.length > 0) {
    setActiveType(typeKeys[0]);
  }

  const activeCategories = (activeType && activeType !== 'ឯកសារយោង (PDF)') ? grouped[activeType] : {};

  return (
    <div className="rounded-2xl sm:rounded-[2rem] shadow-xl p-3.5 sm:p-8 md:p-12 max-w-4xl mx-auto space-y-6 sm:space-y-8 overflow-x-hidden" style={{ backgroundColor: '#ffffca' }}>
      <div className="text-center space-y-2 sm:space-y-4 relative">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 font-khmer">ឯកសារមេរៀន និង វិញ្ញាសា</h1>
        <p className="text-sm sm:text-base md:text-lg text-slate-600 font-khmer mb-4 sm:mb-6">{ministry.name}</p>
      </div>

      {/* Tabs for Document Types */}
      {typeKeys.length > 1 && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center border-b border-slate-200/50 pb-4 sm:pb-6">
          {typeKeys.map((typeLabel) => (
            <button
              key={typeLabel}
              onClick={() => setActiveType(typeLabel)}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 sm:gap-2 ${
                activeType === typeLabel
                  ? 'bg-[#1B365D] text-white shadow-md'
                  : 'bg-white/50 text-slate-600 hover:bg-white border border-slate-200 hover:text-[#1B365D]'
              }`}
            >
              {typeLabel === 'សំណួរពហុចម្លើយ' && <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              {typeLabel === 'សំណួរចម្លើយ' && <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              {typeLabel === 'ពន្យល់ពាក្យ' && <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              {typeLabel === 'ឯកសារយោង (PDF)' && <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              {typeLabel}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-16 pt-4">
        {activeType && activeType !== 'ឯកសារយោង (PDF)' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold text-[#1B365D] border-b-2 border-[#1B365D]/10 pb-4 flex items-center gap-3">
              {activeType === 'សំណួរពហុចម្លើយ' && <HelpCircle className="w-6 h-6" />}
              {activeType === 'សំណួរចម្លើយ' && <MessageSquare className="w-6 h-6" />}
              {activeType === 'ពន្យល់ពាក្យ' && <Globe className="w-6 h-6" />}
              {activeType}
            </h2>

            <div className="space-y-4">
              {Object.entries(activeCategories).map(([category, items]) => (
                <CategorySection key={category} category={category} items={items} />
              ))}
            </div>
          </div>
        )}

        {activeType === 'ឯកសារយោង (PDF)' && documents.length > 0 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold text-[#1B365D] border-b-2 border-[#1B365D]/10 pb-4 flex items-center gap-3">
              <FileText className="w-6 h-6" />
              ឯកសារយោង (PDF)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documents.map(doc => {
                const isDocFav = favorites.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    className="bg-white/70 p-4 sm:p-5 rounded-2xl border border-white flex items-center justify-between hover:bg-white hover:shadow-lg transition-all group"
                  >
                    <a 
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 overflow-hidden flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-slate-800 line-clamp-2 text-xs sm:text-sm font-khmer">{doc.title}</span>
                    </a>
                    
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleFavorite(doc.id);
                        }}
                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                          isDocFav 
                            ? 'text-rose-500 bg-rose-50 ring-1 ring-rose-200' 
                            : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100'
                        }`}
                        title={isDocFav ? 'ដកឯកសារពីបញ្ជីចូលចិត្ត' : 'រក្សាទុកឯកសារក្នុងបញ្ជីចូលចិត្ត'}
                      >
                        <Heart className={`w-4 h-4 ${isDocFav ? 'fill-current text-rose-500' : ''}`} />
                      </button>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-colors"
                        title="ទាញយក / បើកមើល"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
