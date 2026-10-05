'use client';



import React, { useState, useEffect, useRef } from 'react';
import { useFirebase } from '@/lib/FirebaseProvider';
import { db } from '@/lib/firebase';
import { setDoc, doc, deleteDoc, collection, onSnapshot, updateDoc } from 'firebase/firestore';
import { Ministry, QuizCategory, ShortAnswerCategory } from '@/lib/types';
import { motion, AnimatePresence } from 'motion/react';
import { Save, X, Pencil, ArrowLeft, ArrowUp, ArrowDown, AlertCircle, CheckCircle2, Plus, Trash2, ChevronDown, ChevronUp, GripVertical, ExternalLink, Send, Users, Shield, Crown, Key, BookOpen, Building2, Eye, Download, Palette, Sparkles, Hash, MessageSquare, AlignLeft, AlignCenter, AlignRight, AlignJustify, ArrowUpToLine, ArrowDownToLine, MoveVertical, Type } from 'lucide-react';
import Link from 'next/link';
import SafeImage from '@/components/SafeImage';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { firestoreService } from '@/lib/firestore-service';
import { generateQuizImageBlob, cleanQuestionText } from '@/lib/quiz-image-generator';
import { auth } from '@/lib/firebase';

interface AdminQuizItem {
  question: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string;
  answer?: string;
  explanation?: string;
}

interface AdminCategory {
  category: string;
  items: AdminQuizItem[];
  subCategories?: AdminCategory[];
}

interface AdminUser {
  uid: string;
  username: string;
  source: 'custom' | 'standard';
  role?: 'ADMIN' | 'USER' | 'MEMBER';
  isPremium?: boolean;
  premiumUntil?: { toDate?: () => Date } | string | null;
  createdAt?: { toDate?: () => Date } | string | null;
  lastActiveAt?: { toDate?: () => Date } | string | number | null;
  isOnline?: boolean;
  email?: string;
  name?: string;
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    active: boolean;
    linkedAt: string;
  };
}

interface UserActivityInfo {
  status: 'online' | 'away' | 'offline';
  label: string;
  khmerLabel: string;
  dotColor: string;
  pingColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  subtitle: string;
}

function getUserActivityStatus(user: AdminUser, nowMs: number): UserActivityInfo {
  const lastActiveMs = parseTimestamp(user.lastActiveAt) || parseTimestamp(user.createdAt);
  const diffMinutes = lastActiveMs > 0 ? (nowMs - lastActiveMs) / (1000 * 60) : 999999;

  // Active / Online:
  // If explicitly flagged isOnline and active within 4 minutes, OR active within 2.5 minutes
  if ((user.isOnline && diffMinutes < 4) || diffMinutes <= 2.5) {
    return {
      status: 'online',
      label: 'Online',
      khmerLabel: 'កំពុង Online',
      dotColor: 'bg-emerald-500',
      pingColor: 'bg-emerald-400',
      badgeBg: 'bg-emerald-50',
      badgeBorder: 'border-emerald-200',
      badgeText: 'text-emerald-700',
      subtitle: 'កំពុងប្រើប្រាស់ឥឡូវនេះ'
    };
  }

  // Away / Recently Active (within 15 minutes)
  if (diffMinutes <= 15) {
    const mins = Math.max(1, Math.round(diffMinutes));
    return {
      status: 'away',
      label: 'Away',
      khmerLabel: 'ថ្មីៗនេះ (Away)',
      dotColor: 'bg-amber-400',
      pingColor: '',
      badgeBg: 'bg-amber-50',
      badgeBorder: 'border-amber-200',
      badgeText: 'text-amber-700',
      subtitle: `មុននេះ ${mins} នាទី`
    };
  }

  // Offline
  let subtitle = 'ក្រៅបណ្ដាញ';
  if (lastActiveMs > 0) {
    const diffHours = diffMinutes / 60;
    const diffDays = diffHours / 24;
    if (diffMinutes < 60) {
      subtitle = `មុននេះ ${Math.round(diffMinutes)} នាទី`;
    } else if (diffHours < 24) {
      subtitle = `មុននេះ ${Math.round(diffHours)} ម៉ោង`;
    } else if (diffDays < 7) {
      subtitle = `មុននេះ ${Math.round(diffDays)} ថ្ងៃ`;
    } else {
      subtitle = formatDateString(user.lastActiveAt || user.createdAt);
    }
  }

  return {
    status: 'offline',
    label: 'Offline',
    khmerLabel: 'ក្រៅបណ្ដាញ',
    dotColor: 'bg-slate-300',
    pingColor: '',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-200',
    badgeText: 'text-slate-500',
    subtitle
  };
}

function parseTimestamp(val: { toDate?: () => Date } | string | number | null | undefined): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate().getTime();
  }
  if (typeof val === 'string') {
    const time = new Date(val).getTime();
    return isNaN(time) ? 0 : time;
  }
  return 0;
}

function formatDateString(val: { toDate?: () => Date } | string | number | null | undefined): string {
  if (!val) return '-';
  if (typeof val === 'number') {
    return new Date(val).toLocaleDateString();
  }
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return val.toDate().toLocaleDateString();
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
  }
  return '-';
}

function CategoryEditor({
  categories,
  updateParent,
  type,
  depth = 0,
  parentPath = [],
  onSendTelegram
}: {
  categories: AdminCategory[];
  updateParent: (newCategories: AdminCategory[]) => void;
  type: 'mcq' | 'qa';
  depth?: number;
  parentPath?: string[];
  onSendTelegram?: (item: AdminQuizItem, type: 'mcq' | 'qa', elementId: string, categoryName: string, itemNumber?: number) => void;
}) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggleExpand = (cIdx: number) => {
    setExpanded(prev => ({ ...prev, [cIdx]: prev[cIdx] === undefined ? false : !prev[cIdx] }));
  };

  const handleUpdateCategory = (cIdx: number, updatedCat: AdminCategory) => {
    const newCats = [...categories];
    newCats[cIdx] = updatedCat;
    updateParent(newCats);
  };

  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const parseBulkData = (text: string) => {
      const items: AdminQuizItem[] = [];
      const lines = text?.split('\n');
      let currentItem: AdminQuizItem | null = null;
      let inAnswer = false;
      let lastLineBlank = true;
      
      lines.forEach(line => {
          const trimmedLine = line.trim();
          if (!trimmedLine) {
              lastLineBlank = true;
              return;
          }

          // Question: Find "1. ..." or "១. ..." with optional spaces and delimiters
          const qMatch = trimmedLine.match(/^([០-❾a-zA-Z0-9]+)\s*[.\-)]\s*(.*)/);
          const isProbablyQuestion = qMatch && (lastLineBlank || !inAnswer || trimmedLine.includes('តើ') || trimmedLine.includes('?'));

          if (isProbablyQuestion) {
              if (currentItem) items.push(currentItem);
              currentItem = type === 'mcq' 
                ? { question: qMatch[2], options: [], correctIndex: 0, explanation: '' }
                : { question: qMatch[2], answer: '', explanation: '' };
              inAnswer = false;
              lastLineBlank = false;
              return;
          }

          // Option/Answer
          if (type === 'mcq' && currentItem) {
            const oMatch = trimmedLine.match(/^(ក|ខ|គ|ឃ|ង|ច|ឆ|ជ|ឈ|ញ|[a-dA-D])\s*[.\-)]\s*(.*)/i);
            if (oMatch) {
              const optText = oMatch[2];
              let isCorrect = false;
              let cleanOptText = optText;

              if (/ចម្លើយត្រឹមត្រូវ|ត្រឹមត្រូវ/.test(optText)) {
                isCorrect = true;
                cleanOptText = optText
                  .replace(/\s*\(\s*ចម្លើយត្រឹមត្រូវ\s*\)/g, '')
                  .replace(/\s*\[\s*ចម្លើយត្រឹមត្រូវ\s*\]/g, '')
                  .replace(/\s*ចម្លើយត្រឹមត្រូវ/g, '')
                  .replace(/\s*\(\s*ត្រឹមត្រូវ\s*\)/g, '')
                  .replace(/\s*ត្រឹមត្រូវ/g, '')
                  .trim();
              }
              
              if (!currentItem.options) currentItem.options = [];
              currentItem.options.push(cleanOptText);
              if (isCorrect) currentItem.correctIndex = currentItem.options.length - 1;
            } else {
               // If there is an explanation indicator (like 'យោង' or 'ពន្យល់'), or if options are already populated
               const isExplanationLine = trimmedLine.startsWith('យោង') || 
                                         trimmedLine.startsWith('ពន្យល់') || 
                                         trimmedLine.startsWith('ឯកសារយោង') || 
                                         trimmedLine.toLowerCase().startsWith('ref') || 
                                         trimmedLine.toLowerCase().startsWith('source') ||
                                         (currentItem.options && currentItem.options.length > 0);
               if (isExplanationLine) {
                 currentItem.explanation = currentItem.explanation 
                   ? currentItem.explanation + '\n' + trimmedLine 
                   : trimmedLine;
               } else {
                 currentItem.question = currentItem.question + '\n' + trimmedLine;
               }
            }
          } else if (type === 'qa' && currentItem) {
            // Check for explanation/reference
            if (trimmedLine.startsWith('យោង') || trimmedLine.startsWith('ពន្យល់') || trimmedLine.startsWith('ឯកសារយោង') || trimmedLine.toLowerCase().startsWith('ref') || trimmedLine.toLowerCase().startsWith('source')) {
                currentItem.explanation = currentItem.explanation ? currentItem.explanation + '\n' + trimmedLine : trimmedLine;
                inAnswer = false; // "យោង" usually marks the end of the answer
            } else if (trimmedLine.startsWith('ចម្លើយ') || trimmedLine.startsWith('ចំលើយ')) {
                // Answer looks like "ចម្លើយ: ..." or just text
                inAnswer = true;
                const ansText = trimmedLine.replace(/^(ចម្លើយ|ចំលើយ)\s*[:៖]?\s*/, '').trim();
                currentItem.answer = currentItem.answer ? currentItem.answer + '\n' + ansText : ansText;
            } else if (inAnswer) {
                currentItem.answer = currentItem.answer ? currentItem.answer + '\n' + trimmedLine : trimmedLine;
            } else {
                // If it's after a question but before answer or after explanation
                if (currentItem.explanation) {
                    currentItem.explanation += '\n' + trimmedLine;
                } else {
                    currentItem.question = currentItem.question + '\n' + trimmedLine;
                }
            }
          }
          lastLineBlank = false;
      });
      if (currentItem) items.push(currentItem);
      return items;
  };

  const handleBulkAdd = (cIdx: number) => {
    const newItems = parseBulkData(bulkText);
    handleUpdateCategory(cIdx, { ...categories[cIdx], items: [...(categories[cIdx].items || []), ...newItems] });
    setBulkText('');
    setIsBulkImporting(false);
  };

  const addSubCategory = (cIdx: number) => {
    const newCats = [...categories];
    if (!newCats[cIdx].subCategories) newCats[cIdx].subCategories = [];
    newCats[cIdx].subCategories.push({ category: "New SubCategory", items: [] });
    updateParent(newCats);
    setExpanded(prev => ({ ...prev, [cIdx]: true })); // Expand when adding sub
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      
      const newValue = value.substring(0, start) + "\t" + value.substring(end);
      
      // Update item state based on which textarea it is
      // This is a bit tricky because we're inside a loop, but we can use the ref or just set the value directly then trigger change
      target.value = newValue;
      target.selectionStart = target.selectionEnd = start + 1;
      
      // Trigger the appropriate onChange
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  return (
    <div className={`space-y-4 ${depth > 0 ? 'ml-6 mt-2 border-l border-slate-200 pl-4' : ''}`}>
      {categories.map((cat, cIdx) => {
        const isExpanded = expanded[cIdx] !== false; // Default to true
        return (
        <div key={cIdx} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <button 
                onClick={() => {
                  if (cIdx > 0) {
                    const newCats = [...categories];
                    [newCats[cIdx - 1], newCats[cIdx]] = [newCats[cIdx], newCats[cIdx - 1]];
                    updateParent(newCats);
                  }
                }}
                disabled={cIdx === 0}
                className="text-slate-300 hover:text-blue-500 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => {
                  if (cIdx < categories.length - 1) {
                    const newCats = [...categories];
                    [newCats[cIdx + 1], newCats[cIdx]] = [newCats[cIdx], newCats[cIdx + 1]];
                    updateParent(newCats);
                  }
                }}
                disabled={cIdx === categories.length - 1}
                className="text-slate-300 hover:text-blue-500 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => toggleExpand(cIdx)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            <input 
              type="text" 
              value={cat.category}
              onChange={(e) => handleUpdateCategory(cIdx, { ...cat, category: e.target.value })}
              className="flex-1 font-bold text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none"
            />
            <button 
              onClick={() => addSubCategory(cIdx)} 
              className="px-2 py-1 text-xs font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-all"
            >
              + Sub
            </button>
            <button 
              onClick={() => {
                const newCats = categories.filter((_, i) => i !== cIdx);
                updateParent(newCats);
              }} 
              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          {isExpanded && (
            <div className="space-y-4 ml-8">
              {/* Render Items */}
              <div className="space-y-4">
                {cat.items && cat.items.map((item: AdminQuizItem, iIdx: number) => {
                  const uniqueId = `admin-item-${type}-${depth}-${cIdx}-${iIdx}`;
                  return (
                    <div key={iIdx} id={uniqueId} className="p-4 border border-slate-200 rounded-2xl text-xs bg-white shadow-sm space-y-2.5 relative overflow-hidden">
                      <textarea
                        className="w-full font-bold bg-transparent outline-none border-b border-slate-100 pb-1.5 resize-none overflow-hidden"
                        value={item.question}
                        rows={item.question ? item.question?.split('\n').length : 1}
                        onKeyDown={handleKeyDown}
                        onChange={(e) => {
                          const newItems = [...cat.items];
                          newItems[iIdx].question = e.target.value;
                          handleUpdateCategory(cIdx, { ...cat, items: newItems });
                        }}
                        placeholder="Question"
                      />
                      
                      {type === 'mcq' ? (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {(item.options || []).map((opt: string, oIdx: number) => (
                            <div key={oIdx} className="flex items-center gap-1.5 p-1 bg-slate-50/50 rounded-lg">
                              <input 
                                type="radio"
                                checked={item.correctIndex === oIdx}
                                onChange={() => {
                                  const newItems = [...cat.items];
                                  newItems[iIdx].correctIndex = oIdx;
                                  handleUpdateCategory(cIdx, { ...cat, items: newItems });
                                }}
                                className="cursor-pointer"
                              />
                              <input 
                                value={opt}
                                placeholder={`Option ${oIdx + 1}`}
                                onChange={(e) => {
                                  const newItems = [...cat.items];
                                  if (!newItems[iIdx].options) {
                                    newItems[iIdx].options = [];
                                  }
                                  newItems[iIdx].options![oIdx] = e.target.value;
                                  handleUpdateCategory(cIdx, { ...cat, items: newItems });
                                }}
                                className="text-xs w-full bg-white rounded px-1.5 py-1 outline-none border border-slate-100 focus:border-blue-200"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          value={item.answer}
                          placeholder="Answer"
                          rows={item.answer ? item.answer?.split('\n').length : 1}
                          onKeyDown={handleKeyDown}
                          onChange={(e) => {
                            const newItems = [...cat.items];
                            newItems[iIdx].answer = e.target.value;
                            handleUpdateCategory(cIdx, { ...cat, items: newItems });
                          }}
                          className="text-xs w-full bg-slate-50 border border-slate-100 rounded px-2 py-1.5 outline-none focus:border-blue-200 mt-1 resize-none overflow-hidden"
                        />
                      )}

                      {/* Explanation Field */}
                      <textarea
                        value={item.explanation || ''}
                        placeholder="Explanation (ការពន្យល់ - ស្រេចចិត្ត)"
                        rows={item.explanation ? item.explanation?.split('\n').length : 1}
                        onKeyDown={handleKeyDown}
                        onChange={(e) => {
                          const newItems = [...cat.items];
                          newItems[iIdx].explanation = e.target.value;
                          handleUpdateCategory(cIdx, { ...cat, items: newItems });
                        }}
                        className="text-[10px] w-full bg-slate-50/40 text-slate-500 border border-slate-100/60 rounded px-2 py-1 outline-none focus:border-purple-200 mt-1 resize-none overflow-hidden"
                      />
                      
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100" data-html2canvas-ignore="true">
                        {onSendTelegram ? (
                          <button
                            type="button"
                            onClick={() => {
                              const fullCategoryName = [...parentPath, cat.category].join('_').replace(/[\s>]+/g, '_');
                              onSendTelegram(item, type, uniqueId, fullCategoryName, iIdx + 1)
                            }}
                            className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-blue-600 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-700 px-3 py-1.5 rounded-lg transition-all border border-blue-100/50"
                          >
                            <Send className="w-3 h-3" />
                            <span>ផ្ញើទៅ Telegram</span>
                          </button>
                        ) : <div />}
                        
                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => {
                              if (iIdx > 0) {
                                const newItems = [...cat.items];
                                [newItems[iIdx - 1], newItems[iIdx]] = [newItems[iIdx], newItems[iIdx - 1]];
                                handleUpdateCategory(cIdx, { ...cat, items: newItems });
                              }
                            }}
                            disabled={iIdx === 0}
                            className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              if (iIdx < cat.items.length - 1) {
                                const newItems = [...cat.items];
                                [newItems[iIdx + 1], newItems[iIdx]] = [newItems[iIdx], newItems[iIdx + 1]];
                                handleUpdateCategory(cIdx, { ...cat, items: newItems });
                              }
                            }}
                            disabled={iIdx === cat.items.length - 1}
                            className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              const newItems = cat.items.filter((_: AdminQuizItem, i: number) => i !== iIdx);
                              handleUpdateCategory(cIdx, { ...cat, items: newItems });
                            }}
                            className="text-slate-400 hover:text-red-550 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button 
                  onClick={() => {
                    const newItem = type === 'mcq' 
                      ? { question: "New Question", options: ["", "", "", ""], correctIndex: 0 } 
                      : { question: "New Question", answer: "New Answer" };
                    handleUpdateCategory(cIdx, { ...cat, items: [ ...(cat.items || []), newItem] });
                  }}
                  className="text-[10px] font-bold text-slate-500 w-full py-1 border border-dashed border-slate-200 rounded hover:border-slate-400"
                >
                  + Add Item
                </button>
                <button
                  onClick={() => setIsBulkImporting(!isBulkImporting)}
                  className="text-[10px] font-bold text-blue-500 w-full py-1 mt-1 border border-dashed border-blue-200 rounded hover:border-blue-400"
                >
                  {isBulkImporting ? 'Cancel Bulk' : '+ Bulk Import'}
                </button>
                {isBulkImporting && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={bulkText}
                      onKeyDown={handleKeyDown}
                      onChange={(e) => setBulkText(e.target.value)}
                      className="w-full p-2 text-xs border rounded h-32"
                      placeholder="១. សំណួរ?&#10;ក. ចម្លើយ១&#10;ខ. ចម្លើយ២ (ចម្លើយត្រឹមត្រូវ)"
                    />
                    <button
                      onClick={() => handleBulkAdd(cIdx)}
                      className="text-xs font-bold text-white bg-blue-600 w-full py-1.5 rounded hover:bg-blue-700"
                    >
                      Import Questions
                    </button>
                  </div>
                )}
              </div>

              {/* Recursive Sub-categories */}
              {cat.subCategories && cat.subCategories.length > 0 && (
                <CategoryEditor 
                  categories={cat.subCategories}
                  updateParent={(newSubs) => handleUpdateCategory(cIdx, { ...cat, subCategories: newSubs })}
                  type={type}
                  depth={depth + 1}
                  parentPath={[...parentPath, cat.category]}
                  onSendTelegram={onSendTelegram}
                />
              )}
            </div>
          )}
        </div>
        )})}
        {/* Add Main Category at this depth if needed */}
         <button 
            onClick={() => updateParent([...categories, { category: "New Category", items: [] }])}
            className="text-xs font-bold text-slate-500 w-full py-2 border border-dashed border-slate-200 rounded hover:border-slate-400 mt-2"
          >
            + Add Category
          </button>
      </div>
    );

}
  
export default function AdminPage() {
  const [isMounted, setIsMounted] = useState(false);
  const { ministries, loading, user, authLoading, login, userRole } = useFirebase();

  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Ministry | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'INSTITUTION' | 'SUBJECT' | 'USERS'>('INSTITUTION');
  const [usersInfo, setUsersInfo] = useState<AdminUser[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [currentTick, setCurrentTick] = useState<number>(Date.now());

  useEffect(() => {
    if (activeTab !== 'USERS') return;
    const timer = setInterval(() => {
      setCurrentTick(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, [activeTab]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    if (activeTab === 'USERS') {
      if (!user || userRole !== 'ADMIN') return; // Do not fetch if not authenticated as admin
      const setupListener = async () => {
        try {
          
          let regularUsers: AdminUser[] = [];
          let customUsers: AdminUser[] = [];
          
          const updateCombined = () => {
             const combined = [...customUsers, ...regularUsers];
             combined.sort((a, b) => {
               const timeA = parseTimestamp(a.createdAt);
               const timeB = parseTimestamp(b.createdAt);
               return timeB - timeA;
             });
             setUsersInfo(combined);
          };

          const unsubCustom = onSnapshot(collection(db, 'custom_users'), (querySnapshot) => {
            customUsers = [];
            querySnapshot.forEach((doc) => {
              customUsers.push({ uid: doc.id, username: doc.data().username || doc.id, source: 'custom', ...doc.data() });
            });
            updateCombined();
          }, (error) => {
            console.error("Error fetching custom users:", error);
          });
          
          let unsubStandard: (() => void) | null = null;
          if (auth.currentUser) {
            unsubStandard = onSnapshot(collection(db, 'users'), (querySnapshot) => {
              regularUsers = [];
              querySnapshot.forEach((doc) => {
                const data = doc.data();
                regularUsers.push({ uid: doc.id, username: data.email || data.name || doc.id, source: 'standard', ...data });
              });
              updateCombined();
            }, (error) => {
              console.error("Error fetching standard users:", error);
            });
          }
          
          unsubscribe = () => {
             unsubCustom();
             if (unsubStandard) unsubStandard();
          };
          
        } catch (error) {
          console.error("Error setting up users listener:", error);
        }
      };
      setupListener();
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [activeTab, user, userRole]);

  const handleGrantPremium = (user: AdminUser) => {
    setUserActionDialog({ type: 'GRANT_PREMIUM', username: user.username, uid: user.uid, source: user.source });
  };

  const handleRevokePremium = (user: AdminUser) => {
    setUserActionDialog({ type: 'REVOKE_PREMIUM', username: user.username, uid: user.uid, source: user.source });
  };

  const handleDeleteUser = (user: AdminUser) => {
    setUserActionDialog({ type: 'DELETE_USER', username: user.username, uid: user.uid, source: user.source });
  };

  const handleResetPassword = (user: AdminUser) => {
    setNewPasswordValue("");
    setUserActionDialog({ type: 'RESET_PASSWORD', username: user.username, uid: user.uid, source: user.source });
  };

  const confirmUserAction = async () => {
    if (!userActionDialog) return;
    const { type, username, uid, source } = userActionDialog;
    
    try {
      
      const collectionName = source === 'custom' ? 'custom_users' : 'users';
      const docId = source === 'custom' ? username.toLowerCase() : uid;
      const userRef = doc(db, collectionName, docId);

      if (type === 'DELETE_USER') {
        await deleteDoc(userRef);
        setUsersInfo(usersInfo.filter((u: AdminUser) => u.uid !== uid));
        setUserActionDialog(null);
      } else {
        const updateData: Partial<AdminUser> & { password?: string } = {};
        if (type === 'GRANT_PREMIUM') {
          updateData.isPremium = true;
          updateData.premiumUntil = "2099-12-31T23:59:59.000Z"; 
        } else if (type === 'REVOKE_PREMIUM') {
          updateData.isPremium = false;
          updateData.premiumUntil = null;
        } else if (type === 'RESET_PASSWORD') {
          if (source === 'standard') {
             setUserActionDialog(null);
             return;
          }
          if (!newPasswordValue || newPasswordValue.trim().length === 0) return;
          updateData.password = newPasswordValue.trim();
        }
        
        await updateDoc(userRef, updateData as Record<string, unknown>);
        
        setUsersInfo(usersInfo.map((u: AdminUser) => {
          if (u.uid === uid) {
            return { ...u, ...updateData };
          }
          return u;
        }));
        setUserActionDialog(null);
      }
    } catch (e) {
      console.error("Action error", e);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, name: string} | null>(null);
  const [userActionDialog, setUserActionDialog] = useState<{type: 'GRANT_PREMIUM' | 'REVOKE_PREMIUM' | 'DELETE_USER' | 'RESET_PASSWORD', username: string, uid: string, source: 'custom' | 'standard'} | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);

  // Telegram Sending State
  const [sendingQuiz, setSendingQuiz] = useState<AdminQuizItem | null>(null);
  const [sendingQuizType, setSendingQuizType] = useState<'mcq' | 'qa' | null>(null);
  const [sendingCategoryName, setSendingCategoryName] = useState<string>('');
  const [sendingItemNumber, setSendingItemNumber] = useState<number>(1);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramFormat, setTelegramFormat] = useState<'POLL' | 'TEXT' | 'IMAGE'>('TEXT');
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramProgress, setTelegramProgress] = useState("");
  const [telegramError, setTelegramError] = useState("");

  // Telegram Image Poster Customization State
  const [posterLayout, setPosterLayout] = useState<'MODERN_DARK' | 'EDITORIAL_LIGHT' | 'ROYAL_GOLD'>('MODERN_DARK');
  const [posterFooterBrand, setPosterFooterBrand] = useState('Master Quiz KH • វិញ្ញាសាផ្លូវការ');
  const [posterFooterTagline, setPosterFooterTagline] = useState('កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ និងស្ថាប័នសាធារណៈ');
  const [posterFooterHandle, setPosterFooterHandle] = useState('@qiuzs_bot');
  const [posterShowAnswer, setPosterShowAnswer] = useState(true);
  const [posterShowExplanation, setPosterShowExplanation] = useState(true);
  const [posterIncludeProgramLogo, setPosterIncludeProgramLogo] = useState(true);
  const [posterProgramLogo, setPosterProgramLogo] = useState('https://i.ibb.co/FkGwqJVL/3-QCM-Ep4-1.jpg');
  const [posterTextAlign, setPosterTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('center');
  const [posterVerticalAlign, setPosterVerticalAlign] = useState<'top' | 'center' | 'bottom'>('top');
  const [posterOptionsAlign, setPosterOptionsAlign] = useState<'left' | 'center' | 'right'>('left');
  const [posterFontSize, setPosterFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);
  const [isPreviewingPoster, setIsPreviewingPoster] = useState(false);

  // Telegram Text Format Customization State
  const [textIncludeAnswer, setTextIncludeAnswer] = useState(true);
  const [textUseSpoiler, setTextUseSpoiler] = useState(false);
  const [textIncludeExplanation, setTextIncludeExplanation] = useState(true);
  const [textIncludeHeader, setTextIncludeHeader] = useState<boolean>(false);
  const [textAnswerChoiceOnly, setTextAnswerChoiceOnly] = useState<boolean>(true);
  const [includeItemNumber, setIncludeItemNumber] = useState<boolean>(false);

  // Load chat ID and poster preferences on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vignasa_telegram_chat_id') || localStorage.getItem('telegramChatId') || "";
      if (saved) setTelegramChatId(saved);

      const savedLayout = localStorage.getItem('vignasa_poster_layout') as 'MODERN_DARK' | 'EDITORIAL_LIGHT' | 'ROYAL_GOLD' | null;
      if (savedLayout) setPosterLayout(savedLayout);

      const savedBrand = localStorage.getItem('vignasa_poster_footer_brand');
      if (savedBrand) setPosterFooterBrand(savedBrand);

      const savedTagline = localStorage.getItem('vignasa_poster_footer_tagline');
      if (savedTagline) setPosterFooterTagline(savedTagline);

      const savedHandle = localStorage.getItem('vignasa_poster_footer_handle');
      if (savedHandle) setPosterFooterHandle(savedHandle);

      const savedShowAnswer = localStorage.getItem('vignasa_poster_show_answer');
      if (savedShowAnswer !== null) setPosterShowAnswer(savedShowAnswer === 'true');

      const savedShowExp = localStorage.getItem('vignasa_poster_show_exp');
      if (savedShowExp !== null) setPosterShowExplanation(savedShowExp === 'true');

      const savedIncLogo = localStorage.getItem('vignasa_poster_inc_logo');
      if (savedIncLogo !== null) setPosterIncludeProgramLogo(savedIncLogo === 'true');

      const savedLogo = localStorage.getItem('vignasa_poster_logo');
      if (savedLogo) setPosterProgramLogo(savedLogo);

      const savedTextAlign = localStorage.getItem('vignasa_poster_text_align') as 'left' | 'center' | 'right' | 'justify' | null;
      if (savedTextAlign) setPosterTextAlign(savedTextAlign);

      const savedVerticalAlign = localStorage.getItem('vignasa_poster_vertical_align') as 'top' | 'center' | 'bottom' | null;
      if (savedVerticalAlign) setPosterVerticalAlign(savedVerticalAlign);

      const savedOptionsAlign = localStorage.getItem('vignasa_poster_options_align') as 'left' | 'center' | 'right' | null;
      if (savedOptionsAlign) setPosterOptionsAlign(savedOptionsAlign);

      const savedFontSize = localStorage.getItem('vignasa_poster_font_size') as 'small' | 'medium' | 'large' | null;
      if (savedFontSize) setPosterFontSize(savedFontSize);

      const savedFormat = localStorage.getItem('vignasa_telegram_format') as 'POLL' | 'TEXT' | 'IMAGE' | null;
      if (savedFormat) setTelegramFormat(savedFormat);

      const savedTextAns = localStorage.getItem('vignasa_text_show_answer');
      if (savedTextAns !== null) setTextIncludeAnswer(savedTextAns === 'true');

      const savedTextSpoiler = localStorage.getItem('vignasa_text_use_spoiler');
      if (savedTextSpoiler !== null) setTextUseSpoiler(savedTextSpoiler === 'true');

      const savedTextExp = localStorage.getItem('vignasa_text_show_exp');
      if (savedTextExp !== null) setTextIncludeExplanation(savedTextExp === 'true');

      // User explicitly requested: "No need to include this part" -> header omitted by default
      const savedHeader = localStorage.getItem('vignasa_text_show_header');
      if (savedHeader === 'true') {
        setTextIncludeHeader(true);
      } else {
        setTextIncludeHeader(false);
      }

      const savedChoiceOnly = localStorage.getItem('vignasa_text_choice_only');
      if (savedChoiceOnly !== null) setTextAnswerChoiceOnly(savedChoiceOnly === 'true');

      // User requested: "You do not need to include a sequence number when sending it out." -> sequence number omitted by default
      const savedIncItemNum = localStorage.getItem('vignasa_include_sequence_number');
      if (savedIncItemNum === 'true') {
        setIncludeItemNumber(true);
      } else {
        setIncludeItemNumber(false);
      }
    }
  }, []);

  const savePosterConfig = (
    layoutVal: 'MODERN_DARK' | 'EDITORIAL_LIGHT' | 'ROYAL_GOLD',
    brandVal: string,
    taglineVal: string,
    handleVal: string,
    ansVal: boolean,
    expVal: boolean,
    incLogoVal: boolean = true,
    logoVal: string = "https://i.ibb.co/FkGwqJVL/3-QCM-Ep4-1.jpg",
    textAlignVal: 'left' | 'center' | 'right' | 'justify' = posterTextAlign,
    verticalAlignVal: 'top' | 'center' | 'bottom' = posterVerticalAlign,
    optionsAlignVal: 'left' | 'center' | 'right' = posterOptionsAlign,
    fontSizeVal: 'small' | 'medium' | 'large' = posterFontSize
  ) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vignasa_poster_layout', layoutVal);
      localStorage.setItem('vignasa_poster_footer_brand', brandVal);
      localStorage.setItem('vignasa_poster_footer_tagline', taglineVal);
      localStorage.setItem('vignasa_poster_footer_handle', handleVal);
      localStorage.setItem('vignasa_poster_show_answer', String(ansVal));
      localStorage.setItem('vignasa_poster_show_exp', String(expVal));
      localStorage.setItem('vignasa_poster_inc_logo', String(incLogoVal));
      localStorage.setItem('vignasa_poster_logo', logoVal);
      localStorage.setItem('vignasa_poster_text_align', textAlignVal);
      localStorage.setItem('vignasa_poster_vertical_align', verticalAlignVal);
      localStorage.setItem('vignasa_poster_options_align', optionsAlignVal);
      localStorage.setItem('vignasa_poster_font_size', fontSizeVal);
    }
  };

  const handleGeneratePosterPreview = async (overrideParams?: {
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    verticalAlign?: 'top' | 'center' | 'bottom';
    optionsAlign?: 'left' | 'center' | 'right';
    fontSize?: 'small' | 'medium' | 'large';
  }) => {
    if (!sendingQuiz) return;
    setIsPreviewingPoster(true);
    setTelegramError("");
    const curTextAlign = overrideParams?.textAlign || posterTextAlign;
    const curVerticalAlign = overrideParams?.verticalAlign || posterVerticalAlign;
    const curOptionsAlign = overrideParams?.optionsAlign || posterOptionsAlign;
    const curFontSize = overrideParams?.fontSize || posterFontSize;

    try {
      if (posterPreviewUrl) {
        URL.revokeObjectURL(posterPreviewUrl);
        setPosterPreviewUrl(null);
      }
      savePosterConfig(
        posterLayout,
        posterFooterBrand,
        posterFooterTagline,
        posterFooterHandle,
        posterShowAnswer,
        posterShowExplanation,
        posterIncludeProgramLogo,
        posterProgramLogo,
        curTextAlign,
        curVerticalAlign,
        curOptionsAlign,
        curFontSize
      );

      const blob = await generateQuizImageBlob(
        {
          question: cleanQuestionText(sendingQuiz.question),
          type: sendingQuizType || 'mcq',
          options: sendingQuiz.options,
          correctIndex: sendingQuiz.correctIndex,
          answer: sendingQuiz.answer,
          explanation: sendingQuiz.explanation
        },
        {
          khmerName: editForm?.khmerName,
          name: editForm?.name,
          logo: editForm?.logo
        },
        {
          layout: posterLayout,
          footerBrand: posterFooterBrand,
          footerTagline: posterFooterTagline,
          footerHandle: posterFooterHandle,
          showCorrectAnswer: posterShowAnswer,
          showExplanation: posterShowExplanation,
          customCategory: sendingCategoryName,
          includeProgramLogo: true,
          programLogo: posterProgramLogo,
          textAlign: curTextAlign,
          verticalAlign: curVerticalAlign,
          optionsAlign: curOptionsAlign,
          questionFontSize: curFontSize
        }
      );
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        setPosterPreviewUrl(url);
      }
    } catch (e: unknown) {
      console.error("Preview generation error:", e);
      setTelegramError("មិនអាចបង្កើតរូបភាពគំរូបានទេ៖ " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsPreviewingPoster(false);
    }
  };

  const getLiveTextPreview = () => {
    if (!sendingQuiz) return '';
    const enLabels = ["A", "B", "C", "D", "E", "F", "G"];
    const kmLetters = ["ក", "ខ", "គ", "ឃ", "ង", "ច", "ឆ"];
    let optionsBlock = "";
    let correctLetter = "A";
    let correctOptionText = "";

    if (sendingQuizType === 'mcq' && sendingQuiz.options) {
      if (Array.isArray(sendingQuiz.options)) {
        const validOpts = sendingQuiz.options.filter(o => o && o.trim() !== "");
        optionsBlock = validOpts.map((opt: string, idx: number) => {
          const eLabel = enLabels[idx] || String.fromCharCode(65 + idx);
          return `${eLabel}. ${opt}`;
        }).join("\n");

        let targetIdx = sendingQuiz.correctIndex;
        if (targetIdx === undefined && sendingQuiz.correctAnswer) {
          const ca = sendingQuiz.correctAnswer.trim();
          const caUpper = ca.toUpperCase();
          let foundIdx = enLabels.indexOf(caUpper);
          if (foundIdx === -1) foundIdx = kmLetters.indexOf(ca);
          if (foundIdx === -1) foundIdx = validOpts.findIndex(opt => opt.trim() === ca || opt.trim().toLowerCase() === ca.toLowerCase());
          if (foundIdx !== -1) targetIdx = foundIdx;
        }

        if (targetIdx !== undefined && targetIdx >= 0 && validOpts[targetIdx]) {
          correctLetter = enLabels[targetIdx] || "A";
          correctOptionText = validOpts[targetIdx] || "";
        } else if (validOpts[0]) {
          correctLetter = "A";
          correctOptionText = validOpts[0];
        }
      } else if (typeof sendingQuiz.options === 'object' && sendingQuiz.options !== null) {
        const optsObj = sendingQuiz.options as Record<string, string>;
        const entries = Object.entries(optsObj);
        optionsBlock = entries.map(([k, v]) => `${k}. ${v}`).join("\n");
        if (sendingQuiz.correctAnswer && optsObj[sendingQuiz.correctAnswer]) {
          correctLetter = sendingQuiz.correctAnswer.toUpperCase().trim();
          correctOptionText = optsObj[sendingQuiz.correctAnswer];
        } else if (entries[0]) {
          correctLetter = entries[0][0].toUpperCase();
          correctOptionText = entries[0][1];
        }
      }
    } else {
      correctOptionText = sendingQuiz.answer || "";
    }

    let preview = "";
    // User Requirement: "No need to include this part." (Omit header by default)
    if (textIncludeHeader) {
      const categoryFooter = `${editForm?.khmerName || editForm?.name || 'ទូទៅ'}${sendingCategoryName ? `_${sendingCategoryName.replace(/[\s>]+/g, '_')}` : ''}`;
      preview += `🏛️ កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ (Vignasa Quiz KH)\n`;
      preview += `📚 វិញ្ញាសា៖ ${editForm?.khmerName || editForm?.name || 'វិញ្ញាសាទូទៅ'} (${categoryFooter})\n\n`;
    }

    const itemNumPrefix = includeItemNumber && sendingItemNumber ? `សំណួរទី ${sendingItemNumber}៖ ` : `សំណួរ៖ `;
    preview += `${itemNumPrefix}${cleanQuestionText(sendingQuiz.question || '')}\n\n`;

    if (sendingQuizType === 'mcq' && optionsBlock) {
      preview += `${optionsBlock}\n\n`;
    }

    if (textIncludeAnswer) {
      let answerDisplay = "";
      if (sendingQuizType === 'mcq') {
        answerDisplay = textAnswerChoiceOnly 
          ? correctLetter
          : `${correctLetter} (${correctOptionText})`;
      } else {
        answerDisplay = sendingQuiz.answer || '';
      }

      if (textUseSpoiler) {
        preview += `👉 ចម្លើយ៖ [Spoiler: ${answerDisplay}]\n`;
      } else {
        preview += `👉 ចម្លើយ៖ ${answerDisplay}\n`;
      }
    }

    if (textIncludeExplanation && sendingQuiz.explanation && sendingQuiz.explanation.trim() !== "") {
      const trimmedExp = sendingQuiz.explanation.trim();
      const formattedExp = /^(ពន្យល់|យោង|ឯកសារយោង)/.test(trimmedExp) ? trimmedExp : `ពន្យល់ ៖ ${trimmedExp}`;
      preview += `\n💡 ការពន្យល់/យោង៖\n${formattedExp}\n`;
    }

    preview += `\n✈️ ${posterFooterBrand || 'Master Quiz KH'} | ${posterFooterHandle || '@qiuzs_bot'}`;
    return preview;
  };

  const handleCloseTelegramModal = () => {
    setSendingQuiz(null);
    if (posterPreviewUrl) {
      URL.revokeObjectURL(posterPreviewUrl);
      setPosterPreviewUrl(null);
    }
  };

  const handleSendTelegramQuiz = async () => {
    if (!sendingQuiz || !telegramChatId) {
      setTelegramError("សូមបញ្ចូល Chat ID!");
      return;
    }
    setTelegramError("");
    setIsSendingTelegram(true);
    setTelegramProgress("កំពុងដំណើរការ...");

    try {
      localStorage.setItem('vignasa_telegram_chat_id', telegramChatId);
      localStorage.setItem('telegramChatId', telegramChatId);

      const botToken = "8301052612:AAE4QDXA2GMi2nMBxfLe2_v-wQSpd-JrML0";

      const escapeHTML = (str: string) => {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      };

        const categoryFooter = `${editForm?.khmerName || editForm?.name || 'ទូទៅ'}${sendingCategoryName ? `_${sendingCategoryName.replace(/[\s>]+/g, '_')}` : ''}`;
        
        if (telegramFormat === 'TEXT') {
          // Compute options and extract correct answer choice (A, B, C, or D)
          const enLabels = ["A", "B", "C", "D", "E", "F", "G"];
          const kmLetters = ["ក", "ខ", "គ", "ឃ", "ង", "ច", "ឆ"];
          let optionsBlock = "";
          let correctLetter = "A";
          let correctOptionText = "";

          if (sendingQuizType === 'mcq' && sendingQuiz.options) {
            if (Array.isArray(sendingQuiz.options)) {
              const validOpts = sendingQuiz.options.filter(o => o && o.trim() !== "");
              optionsBlock = validOpts.map((opt: string, idx: number) => {
                const eLabel = enLabels[idx] || String.fromCharCode(65 + idx);
                return `<b>${eLabel}.</b> ${escapeHTML(opt)}`;
              }).join("\n");

              let targetIdx = sendingQuiz.correctIndex;
              if (targetIdx === undefined && sendingQuiz.correctAnswer) {
                const ca = sendingQuiz.correctAnswer.trim();
                const caUpper = ca.toUpperCase();
                let foundIdx = enLabels.indexOf(caUpper);
                if (foundIdx === -1) foundIdx = kmLetters.indexOf(ca);
                if (foundIdx === -1) foundIdx = validOpts.findIndex(opt => opt.trim() === ca || opt.trim().toLowerCase() === ca.toLowerCase());
                if (foundIdx !== -1) targetIdx = foundIdx;
              }

              if (targetIdx !== undefined && targetIdx >= 0 && validOpts[targetIdx]) {
                correctLetter = enLabels[targetIdx] || "A";
                correctOptionText = validOpts[targetIdx] || "";
              } else if (validOpts[0]) {
                correctLetter = "A";
                correctOptionText = validOpts[0];
              }
            } else if (typeof sendingQuiz.options === 'object' && sendingQuiz.options !== null) {
              const optsObj = sendingQuiz.options as Record<string, string>;
              const entries = Object.entries(optsObj);
              optionsBlock = entries.map(([k, v]) => `<b>${k}.</b> ${escapeHTML(v)}`).join("\n");
              if (sendingQuiz.correctAnswer && optsObj[sendingQuiz.correctAnswer]) {
                correctLetter = sendingQuiz.correctAnswer.toUpperCase().trim();
                correctOptionText = optsObj[sendingQuiz.correctAnswer];
              } else if (entries[0]) {
                correctLetter = entries[0][0].toUpperCase();
                correctOptionText = entries[0][1];
              }
            }
          }

          let text = "";
          // User Requirement: "No need to include this part." (Omit header by default)
          if (textIncludeHeader) {
            text += `🏛️ <b>កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ (Vignasa Quiz KH)</b>\n`;
            text += `📚 <b>វិញ្ញាសា៖</b> ${escapeHTML(editForm?.khmerName || editForm?.name || 'វិញ្ញាសាទូទៅ')} (${escapeHTML(categoryFooter)})\n\n`;
          }

          // Sequence Number and Question (Omitted by default as requested)
          const itemNumPrefix = includeItemNumber && sendingItemNumber ? `<b>សំណួរទី ${sendingItemNumber}៖</b> ` : `<b>សំណួរ៖</b> `;
          text += `${itemNumPrefix}${escapeHTML(cleanQuestionText(sendingQuiz.question || ''))}\n\n`;

          if (sendingQuizType === 'mcq' && optionsBlock) {
            text += `${optionsBlock}\n\n`;
          }

          // User Requirement: "Please submit your answer choice (A, B, C, or D) and the item number"
          if (textIncludeAnswer) {
            let answerDisplay = "";
            if (sendingQuizType === 'mcq') {
              answerDisplay = textAnswerChoiceOnly 
                ? `<b>${correctLetter}</b>`
                : `<b>${correctLetter}</b> (${escapeHTML(correctOptionText)})`;
            } else {
              answerDisplay = `<b>${escapeHTML(sendingQuiz.answer || '')}</b>`;
            }

            if (textUseSpoiler) {
              text += `👉 <b>ចម្លើយ៖</b> <tg-spoiler>${answerDisplay}</tg-spoiler>\n`;
            } else {
              text += `👉 <b>ចម្លើយ៖</b> ${answerDisplay}\n`;
            }
          }

          if (textIncludeExplanation && sendingQuiz.explanation && sendingQuiz.explanation.trim() !== "") {
            const trimmedExp = sendingQuiz.explanation.trim();
            const formattedExp = /^(ពន្យល់|យោង|ឯកសារយោង)/.test(trimmedExp) ? trimmedExp : `ពន្យល់ ៖ ${trimmedExp}`;
            text += `\n💡 <b>ការពន្យល់/យោង៖</b>\n${escapeHTML(formattedExp)}\n`;
          }

          const footerLink = posterFooterHandle.startsWith('@') 
            ? `https://t.me/${posterFooterHandle.replace('@', '')}` 
            : 'https://t.me/qiuzs_bot';

          text += `\n✈️ <a href="${footerLink}">${escapeHTML(posterFooterBrand || 'Master Quiz KH')}</a> | ${escapeHTML(posterFooterHandle || '@qiuzs_bot')}`;

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId.trim(),
            text,
            parse_mode: 'HTML'
          })
        });
        if (!res.ok) throw new Error((await res.json()).description);

      } else if (telegramFormat === 'POLL') {
        if (sendingQuizType !== 'mcq') {
          throw new Error("ទម្រង់ Poll អាចប្រើប្រាស់បានតែជាមួយសំណួរពហុជ្រើសរើស (MCQ) តែប៉ុណ្ណោះ!");
        }
        if (!sendingQuiz.options || !Array.isArray(sendingQuiz.options) || sendingQuiz.options.length < 2) {
          throw new Error("សំណួរនេះមិនមានជម្រើសគ្រប់គ្រាន់សម្រាប់បង្កើត Poll ទេ។");
        }

        // Prepare choices
        const rawOptions = sendingQuiz.options.filter(Boolean);
        const optionsList = rawOptions.map((opt: string, idx: number) => {
          const label = ["A", "B", "C", "D"][idx] || String.fromCharCode(65 + idx);
          return `${label}. ${opt}`.substring(0, 100);
        });

        if (optionsList.length < 2) throw new Error("ត្រូវការជម្រើសចម្លើយយ៉ាងហោចណាស់ ២។");

        const correctIndex = Math.min(sendingQuiz.correctIndex || 0, optionsList.length - 1);

        const itemNumText = includeItemNumber && sendingItemNumber ? `សំណួរទី ${sendingItemNumber}៖ ` : '';
        const payload: Record<string, unknown> = {
          chat_id: telegramChatId.trim(),
          question: `${itemNumText}${cleanQuestionText(sendingQuiz.question || '')}`.substring(0, 300),
          options: optionsList,
          type: 'quiz',
          correct_option_id: correctIndex,
          is_anonymous: true
        };

        let formattedExplanation = "";
        if (sendingQuiz.explanation) {
           const trimmedExp = sendingQuiz.explanation.trim();
           if (/^(ពន្យល់|យោង|ឯកសារយោង)/.test(trimmedExp)) {
              formattedExplanation = trimmedExp;
           } else {
              formattedExplanation = `ពន្យល់ ៖ ${trimmedExp}`;
           }
        }

        const prefix = `<a href="https://t.me/qiuzs_bot">Master Quiz KH</a> | វិញ្ញាសា | ${categoryFooter}\n\n`;
        const prefixTextLength = `Master Quiz KH | វិញ្ញាសា | ${categoryFooter}\n\n`.length;
        const suffix = "";
        let expText = formattedExplanation;
        if (expText) {
          const allowedLen = 200 - suffix.length - prefixTextLength;
          if (expText.length > allowedLen) {
            expText = expText.substring(0, allowedLen - 3) + "...";
          }
          payload.explanation = prefix + escapeHTML(expText) + suffix;
        } else {
          payload.explanation = prefix.trim();
        }
        payload.explanation_parse_mode = 'HTML';

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPoll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error((await res.json()).description);

      } else if (telegramFormat === 'IMAGE') {
        setTelegramProgress("កំពុងបង្កើតរូបភាព Poster...");
        
        savePosterConfig(
          posterLayout, 
          posterFooterBrand, 
          posterFooterTagline, 
          posterFooterHandle, 
          posterShowAnswer, 
          posterShowExplanation,
          posterIncludeProgramLogo,
          posterProgramLogo,
          posterTextAlign,
          posterVerticalAlign,
          posterOptionsAlign,
          posterFontSize
        );

        const blob = await generateQuizImageBlob(
          {
            question: cleanQuestionText(sendingQuiz.question),
            type: sendingQuizType || 'mcq',
            options: sendingQuiz.options,
            correctIndex: sendingQuiz.correctIndex,
            answer: sendingQuiz.answer,
            explanation: sendingQuiz.explanation
          },
          {
            khmerName: editForm?.khmerName,
            name: editForm?.name,
            logo: editForm?.logo
          },
          {
            layout: posterLayout,
            footerBrand: posterFooterBrand,
            footerTagline: posterFooterTagline,
            footerHandle: posterFooterHandle,
            showCorrectAnswer: posterShowAnswer,
            showExplanation: posterShowExplanation,
            customCategory: sendingCategoryName,
            includeProgramLogo: true,
            programLogo: posterProgramLogo,
            textAlign: posterTextAlign,
            verticalAlign: posterVerticalAlign,
            optionsAlign: posterOptionsAlign,
            questionFontSize: posterFontSize
          }
        );

        if (!blob || blob.size === 0) throw new Error("បរាជ័យក្នុងការបង្កើតឯកសាររូបភាព Poster!");

        setTelegramProgress("កំពុងផ្ញើរូបភាព Poster ទៅ Telegram...");
        const formData = new FormData();
        formData.append("chat_id", telegramChatId.trim());
        formData.append("photo", blob, "quiz_poster.png");

        // Format options and extract correct answer choice (A, B, C, or D)
        const enLabels = ["A", "B", "C", "D", "E", "F", "G"];
        const kmLetters = ["ក", "ខ", "គ", "ឃ", "ង", "ច", "ឆ"];
        let optionsFormattedText = "";
        let correctAnswerFullText = "";
        let correctLetter = "A";

        if (sendingQuizType === 'mcq' && sendingQuiz.options) {
          if (Array.isArray(sendingQuiz.options)) {
            const validOpts = sendingQuiz.options.filter(o => o && o.trim() !== "");
            optionsFormattedText = validOpts.map((opt, i) => `<b>${enLabels[i] || String.fromCharCode(65 + i)}.</b> ${escapeHTML(opt)}`).join("\n");
            
            let targetIdx = sendingQuiz.correctIndex;
            if (targetIdx === undefined && sendingQuiz.correctAnswer) {
              const ca = sendingQuiz.correctAnswer.trim();
              const caUpper = ca.toUpperCase();
              let foundIdx = enLabels.indexOf(caUpper);
              if (foundIdx === -1) foundIdx = kmLetters.indexOf(ca);
              if (foundIdx === -1) foundIdx = validOpts.findIndex(opt => opt.trim() === ca || opt.trim().toLowerCase() === ca.toLowerCase());
              if (foundIdx !== -1) targetIdx = foundIdx;
            }

            if (targetIdx !== undefined && validOpts[targetIdx]) {
              correctLetter = enLabels[targetIdx] || "A";
              correctAnswerFullText = validOpts[targetIdx];
            } else if (validOpts[0]) {
              correctLetter = "A";
              correctAnswerFullText = validOpts[0];
            }
          } else if (typeof sendingQuiz.options === 'object' && sendingQuiz.options !== null) {
            const optsObj = sendingQuiz.options as Record<string, string>;
            const entries = Object.entries(optsObj);
            optionsFormattedText = entries.map(([k, v]) => `<b>${k}.</b> ${escapeHTML(v)}`).join("\n");
            if (sendingQuiz.correctAnswer && optsObj[sendingQuiz.correctAnswer]) {
              correctLetter = sendingQuiz.correctAnswer.toUpperCase().trim();
              correctAnswerFullText = optsObj[sendingQuiz.correctAnswer];
            }
          }
        } else {
          correctAnswerFullText = sendingQuiz.answer || "";
        }

        const footerLink = posterFooterHandle.startsWith('@') 
          ? `https://t.me/${posterFooterHandle.replace('@', '')}` 
          : 'https://t.me/qiuzs_bot';

        let caption = "";
        let companionFullMessage = "";

        if (!posterShowAnswer) {
          // =========================================================================
          // IMAGE CONTAINS ONLY THE QUESTION:
          // User Requirement: "If the image contains only the question, please also 
          // provide the question and answer as text alongside the image."
          // =========================================================================
          let fullCompanion = "";
          if (textIncludeHeader) {
            fullCompanion += `🏛️ <b>កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ (Vignasa Quiz KH)</b>\n`;
            fullCompanion += `📚 <b>វិញ្ញាសា៖</b> ${escapeHTML(editForm?.khmerName || editForm?.name || 'វិញ្ញាសាទូទៅ')} (${escapeHTML(categoryFooter)})\n\n`;
          }

          const itemNumPrefix = includeItemNumber && sendingItemNumber ? `<b>សំណួរទី ${sendingItemNumber}៖</b> ` : `<b>សំណួរ៖</b> `;
          fullCompanion += `${itemNumPrefix}${escapeHTML(cleanQuestionText(sendingQuiz.question || ''))}\n\n`;

          if (sendingQuizType === 'mcq' && optionsFormattedText) {
            fullCompanion += `${optionsFormattedText}\n\n`;
          }

          if (sendingQuizType === 'mcq') {
            const answerDisplay = textAnswerChoiceOnly ? `<b>${correctLetter}</b>` : `<b>${correctLetter}</b> (${escapeHTML(correctAnswerFullText)})`;
            fullCompanion += `👉 <b>ចម្លើយ៖</b> <tg-spoiler>${answerDisplay}</tg-spoiler>\n`;
          } else if (correctAnswerFullText) {
            fullCompanion += `👉 <b>ចម្លើយ៖</b> <tg-spoiler><b>${escapeHTML(correctAnswerFullText)}</b></tg-spoiler>\n`;
          }

          if (sendingQuiz.explanation && sendingQuiz.explanation.trim() !== "") {
            const trimmedExp = sendingQuiz.explanation.trim();
            const expFormatted = /^(ពន្យល់|យោង|ឯកសារយោង)/.test(trimmedExp) ? trimmedExp : `ពន្យល់ ៖ ${trimmedExp}`;
            fullCompanion += `\n💡 <b>ការពន្យល់/យោង៖</b>\n${escapeHTML(expFormatted)}\n`;
          }

          fullCompanion += `\n✈️ <a href="${footerLink}">${escapeHTML(posterFooterBrand || 'Master Quiz KH')}</a> | ${escapeHTML(posterFooterHandle)}`;

          if (fullCompanion.length <= 1000) {
            caption = fullCompanion;
          } else {
            // If the combined text exceeds Telegram's 1024-char caption limit, 
            // set a concise caption and send companion full text alongside
            const answerShortDisplay = sendingQuizType === 'mcq' 
              ? (textAnswerChoiceOnly ? `<b>${correctLetter}</b>` : `<b>${correctLetter}</b> (${escapeHTML(correctAnswerFullText)})`)
              : `<b>${escapeHTML(correctAnswerFullText)}</b>`;

            caption = (textIncludeHeader ? `🏛️ <b>កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ (Vignasa Quiz KH)</b>\n` : '') +
                      `${itemNumPrefix}${escapeHTML(cleanQuestionText(sendingQuiz.question || '').substring(0, 240))}...\n\n` +
                      (correctAnswerFullText ? `👉 <b>ចម្លើយ៖</b> <tg-spoiler>${answerShortDisplay}</tg-spoiler>\n\n` : '') +
                      `<i>(សូមពិនិត្យសំណួរ ចម្លើយពេញលេញ និងការពន្យល់ក្នុងសារអត្ថបទខាងក្រោម)</i>\n\n` +
                      `✈️ <a href="${footerLink}">${escapeHTML(posterFooterBrand || 'Master Quiz KH')}</a> | ${escapeHTML(posterFooterHandle)}`;
            companionFullMessage = fullCompanion;
          }

        } else {
          // =========================================================================
          // IMAGE CONTAINS BOTH QUESTION AND ANSWER:
          // User Requirement:
          // 1. Submit answer choice (A, B, C, or D)
          // 2. "No need to include this part" -> omit institutional header
          // 3. "You do not need to include a sequence number when sending it out."
          // =========================================================================
          const itemNumPrefix = includeItemNumber && sendingItemNumber ? `<b>សំណួរទី ${sendingItemNumber}៖</b> ` : `<b>សំណួរ៖</b> `;
          let bothCaption = "";
          if (textIncludeHeader) {
            bothCaption += `🏛️ <b>កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ (Vignasa Quiz KH)</b>\n`;
            bothCaption += `📚 <b>វិញ្ញាសា៖</b> ${escapeHTML(editForm?.khmerName || editForm?.name || 'វិញ្ញាសាទូទៅ')} (${escapeHTML(categoryFooter)})\n\n`;
          }
          bothCaption += `${itemNumPrefix}${escapeHTML(cleanQuestionText(sendingQuiz.question || '').substring(0, 280))}\n\n`;
          bothCaption += `<i>(សូមពិនិត្យចម្លើយ និងការពន្យល់លម្អិតក្នុងរូបភាព Poster ខាងលើ)</i>\n`;

          if (sendingQuizType === 'mcq') {
            const answerDisplay = textAnswerChoiceOnly 
              ? `<b>${correctLetter}</b>`
              : `<b>${correctLetter}</b> (${escapeHTML(correctAnswerFullText.substring(0, 120))})`;
            bothCaption += `\n👉 <b>ចម្លើយ៖</b> ${answerDisplay}\n`;
          } else if (correctAnswerFullText) {
            bothCaption += `\n👉 <b>ចម្លើយ៖</b> <b>${escapeHTML(correctAnswerFullText.substring(0, 150))}</b>\n`;
          }

          if (posterShowExplanation && sendingQuiz.explanation) {
            const exp = sendingQuiz.explanation.trim();
            bothCaption += `\n💡 <b>${escapeHTML(/^(ពន្យល់|យោង)/.test(exp) ? exp : `ពន្យល់៖ ${exp}`)}</b>\n`;
          }
          bothCaption += `\n✈️ <a href="${footerLink}">${escapeHTML(posterFooterBrand || 'Master Quiz KH')}</a> | ${escapeHTML(posterFooterHandle)}`;
          caption = bothCaption.length <= 1000 ? bothCaption : bothCaption.substring(0, 980) + `...\n\n<a href="${footerLink}">${escapeHTML(posterFooterBrand)}</a>`;
        }

        formData.append("caption", caption);
        formData.append("parse_mode", "HTML");

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) throw new Error((await res.json()).description);

        if (companionFullMessage) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId.trim(),
              text: companionFullMessage,
              parse_mode: 'HTML',
              disable_web_page_preview: true
            })
          });
        }
      }

      setTelegramProgress("ផ្ញើទៅ Telegram បានជោគជ័យ! 🎉");
      setTimeout(() => {
        setSendingQuiz(null);
      }, 1500);
    } catch (err: unknown) {
      console.error(err);
      let errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg?.includes("chat not found")) {
        errorMsg = "រកមិនឃើញ Chat ទេ! សូមប្រាកដថាអ្នកបានបញ្ជាក់ ID ត្រឹមត្រូវ និងបានបញ្ចូល Bot (@VignasaCambodia_Bot) ទៅក្នុង Group/Channel ជា Admin ឬអ្នកបានចុច Start Bot នេះរួចហើយ។";
      }
      setTelegramError(`មិនអាចផ្ញើបានទេ៖ ${errorMsg}`);
    } finally {
      setIsSendingTelegram(false);
      setTelegramProgress("");
    }
  };

  const validateUrl = (url: string) => {
    if (!url) return "URL is required";
    try {
      new URL(url);
      return null;
    } catch {
      return "Please enter a valid URL (e.g., https://example.com/logo.png)";
    }
  };

  const prepareFormForSave = (form: Ministry) => {
    const dataToSave = { ...form };
    const quizzes: import('@/lib/types').Quiz[] = [];
    
    const flattenMcqs = (cats: import('@/lib/types').QuizCategory[], path: string = "") => {
      cats.forEach((cat) => {
        const fullPath = path ? `${path} > ${cat.category}` : cat.category;
        cat.items.forEach((item, iIdx) => {
          quizzes.push({
            id: `mcq_${fullPath}_${iIdx}_${Date.now()}`,
            type: 'MULTIPLE_CHOICE',
            category: fullPath,
            question: item.question,
            options: item.options.reduce((acc, opt, i) => ({...acc, [String.fromCharCode(65 + i)]: opt}), {}),
            correctAnswer: String.fromCharCode(65 + item.correctIndex),
            explanation: item.explanation || ""
          });
        });
        if (cat.subCategories) flattenMcqs(cat.subCategories, fullPath);
      });
    };

    if (dataToSave.mcqs) flattenMcqs(dataToSave.mcqs);

    const flattenQa = (cats: import('@/lib/types').ShortAnswerCategory[], path: string = "") => {
      cats.forEach((cat) => {
        const fullPath = path ? `${path} > ${cat.category}` : cat.category;
        cat.items.forEach((item, iIdx) => {
          quizzes.push({
            id: `qa_${fullPath}_${iIdx}_${Date.now()}`,
            type: 'Q_AND_A',
            category: fullPath,
            question: item.question,
            answer: item.answer,
            explanation: item.explanation || ""
          });
        });
        if (cat.subCategories) flattenQa(cat.subCategories, fullPath);
      });
    };

    if (dataToSave.shortAnswers) flattenQa(dataToSave.shortAnswers);

    if (dataToSave.terms) {
      dataToSave.terms.forEach((item, iIdx) => {
        quizzes.push({
          id: `vocab_${iIdx}_${Date.now()}`,
          type: 'VOCABULARY',
          category: 'Vocabulary',
          question: item.term,
          answer: item.definition
        });
      });
    }

    dataToSave.quizzes = quizzes;
    return dataToSave;
  };

  useEffect(() => {
    if (editingId && editForm) {
      if (initialLoadRef.current) {
         initialLoadRef.current = false;
         return; // Skip first save to avoid unnecessary writes, though we reset it on edit
      }
      
      const error = validateUrl(editForm.logo);
      if (error) return; // Don't auto-save if URL is bad

      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(async () => {
        setAutoSaving(true);
        try {
          const finalData = prepareFormForSave(editForm);
          await setDoc(doc(db, 'ministries', editingId), finalData, { merge: true });
        } catch (e) {
          console.error("Auto-save error:", e);
        } finally {
          setAutoSaving(false);
        }
      }, 1000);
    }
  }, [editForm, editingId]);

  // When edit dialog opens, we want to reset initial load flag so we don't save the untouched record
  useEffect(() => {
     if (editingId) {
        initialLoadRef.current = true;
     }
  }, [editingId]);

  const handleEdit = (ministry: Ministry) => {
    setEditingId(ministry.id);
    setEditForm({ ...ministry });
    setUrlError(null);
  };

  const handleSave = async () => {
    if (!editForm) return;

    const error = validateUrl(editForm.logo);
    if (error) {
      setUrlError(error);
      return;
    }

    setSaving(true);
    try {
      const finalData = prepareFormForSave(editForm);
      await setDoc(doc(db, 'ministries', editForm.id), finalData);
      setEditingId(null);
      setEditForm(null);
      setUrlError(null);
    } catch (e) {
      console.error("Save error:", e);
      setUrlError("Failed to save to database. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMinistry = async () => {
    const newId = 'ministry_' + Date.now();
    const newMinistry: Ministry = {
      id: newId,
      name: activeTab === 'SUBJECT' ? "New Subject" : "New Ministry",
      khmerName: activeTab === 'SUBJECT' ? "វិញ្ញាសាថ្មី" : "ក្រសួងថ្មី",
      description: "Description",
      logo: "https://picsum.photos/seed/ministry/200/200",
      color: "#0f172a",
      groupType: activeTab === 'SUBJECT' ? 'SUBJECT' : 'INSTITUTION',
      subjectType: 'MCQ',
      mcqs: [],
      shortAnswers: [],
      terms: []
    };
    
    setEditingId(newId);
    setEditForm(newMinistry);
  };

  const handleDeleteMinistry = async (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const confirmDeleteMinistry = async () => {
    if (!deleteConfirm) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'ministries', deleteConfirm.id));
      if (editingId === deleteConfirm.id) {
        setEditingId(null);
        setEditForm(null);
      }
      setDeleteConfirm(null);
    } catch (e) {
      console.error("Delete error:", e);
      setUrlError("Failed to delete ministry.");
      setDeleteConfirm(null);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof Ministry, value: Ministry[keyof Ministry]) => {
    if (editForm) setEditForm({ ...editForm, [field]: value });
  };

  // Terminology Helpers
  const addTerm = () => {
    const terms = [...(editForm?.terms || []), { term: "", definition: "" }];
    updateField('terms', terms);
  };
  const removeTerm = (index: number) => {
    const terms = (editForm?.terms || []).filter((_, i) => i !== index);
    updateField('terms', terms);
  };

  // MCQ Helpers
  const addMcqCategory = () => {
    const mcqs = [...(editForm?.mcqs || []), { category: "New Category", items: [] }];
    updateField('mcqs', mcqs);
  };

  // QA Helpers
  const addQaCategory = () => {
    const qa = [...(editForm?.shortAnswers || []), { category: "New Category", items: [] }];
    updateField('shortAnswers', qa);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;

    const filteredList = ministries.filter(m => (m.groupType || 'INSTITUTION') === activeTab);
    const items = Array.from(filteredList);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updates = items.map((item, index) => ({ id: item.id, order: index }));

    try {
      await firestoreService.updateMinistryOrders(updates);
    } catch (e) {
      console.error("Failed to update orders", e);
      setUrlError("Failed to reorder items.");
    }
  };

  if (!isMounted || loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || userRole !== 'ADMIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-transparent px-6 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-slate-300" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">សិទ្ធិចូលប្រើប្រាស់ត្រូវបានកំណត់</h1>
        <p className="text-slate-500 mb-8">មានតែអ្នកគ្រប់គ្រងប៉ុណ្ណោះដែលអាចចូលប្រើទំព័រនេះបាន។<br/>(Only admins can access this page.)</p>
        {!user ? (
          <button 
            onClick={() => login('ADMIN')}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
          >
            ចូលជាអ្នកគ្រប់គ្រង (Admin Sign In)
          </button>
        ) : (
          <Link href="/" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
            ត្រឡប់ទៅទំព័រដើម
          </Link>
        )}
        <Link href="/" className="mt-6 text-slate-400 hover:text-slate-600 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> ត្រឡប់ទៅវិញ
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pt-6 sm:pt-8 md:pt-12 pb-12 sm:pb-16 px-3.5 sm:px-6 md:px-12 font-sans overflow-x-hidden">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-800 mb-2 sm:mb-4 transition-colors text-xs sm:text-sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              ត្រឡប់ទៅទំព័រដើម (Back to Home)
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-xs sm:text-sm text-slate-500">Manage ministry information, quizzes, and terms</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {(activeTab === 'INSTITUTION' || activeTab === 'SUBJECT') && (
              <button 
                onClick={handleAddMinistry}
                className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4" /> {activeTab === 'INSTITUTION' ? 'Add Ministry' : 'Add Subject'}
              </button>
            )}
          </div>
        </header>

        <div className="flex gap-4 sm:gap-8 mb-6 sm:mb-8 border-b border-slate-200 overflow-x-auto no-scrollbar py-0.5">
          <button 
            onClick={() => setActiveTab('INSTITUTION')}
            className={`pb-3 sm:pb-4 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'INSTITUTION' ? "text-blue-600 border-b-2 border-blue-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Building2 className="w-4 h-4" /> គ្រប់គ្រងក្រសួង
          </button>
          <button 
            onClick={() => setActiveTab('SUBJECT')}
            className={`pb-3 sm:pb-4 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'SUBJECT' ? "text-blue-600 border-b-2 border-blue-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <BookOpen className="w-4 h-4" /> គ្រប់គ្រងវិញ្ញាសា
          </button>
          <button 
            onClick={() => setActiveTab('USERS')}
            className={`pb-3 sm:pb-4 text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'USERS' ? "text-blue-600 border-b-2 border-blue-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Users className="w-4 h-4" /> គ្រប់គ្រងសមាជិក
          </button>
        </div>

        {urlError && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${urlError.includes('success') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'} border`}>
            {urlError.includes('success') ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <div className="flex-1 text-sm font-medium">{urlError}</div>
            <button onClick={() => setUrlError(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {deleteConfirm && (
           <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div className="flex items-center gap-3 text-red-800 font-medium text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                Are you sure you want to delete &quot;{deleteConfirm.name}&quot;? This action cannot be undone.
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-white text-slate-600 text-sm font-bold border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={confirmDeleteMinistry} disabled={saving} className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all disabled:opacity-50">Delete</button>
              </div>
           </div>
        )}

        {(activeTab === 'INSTITUTION' || activeTab === 'SUBJECT') ? (
          <div>
            <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="ministriesList">
              {(provided) => (
                <div 
                  className="grid gap-6 pb-20"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {(editingId && editForm && !ministries.find(m => m.id === editingId) 
                     ? [editForm, ...ministries] 
                     : ministries).filter(m => (m.groupType || 'INSTITUTION') === activeTab).map((ministry, index) => (
                  <Draggable key={ministry.id} draggableId={ministry.id} index={index} isDragDisabled={!!editingId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={{ ...provided.draggableProps.style }}
                      >
                        <motion.div
                          layout
                          className={`bg-white rounded-3xl border border-slate-200 overflow-hidden ${snapshot.isDragging ? 'shadow-xl ring-2 ring-blue-500/50' : 'shadow-sm'}`}
                        >
                          {editingId === ministry.id && editForm ? (
                            <div className="p-8 space-y-8">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                                <div>
                                  <h2 className="text-2xl font-bold text-slate-900">Editing {ministry.khmerName}</h2>
                                  <p className="text-sm text-slate-500">{ministry.id.toUpperCase()}</p>
                                </div>
                                  <div className="flex items-center gap-3">
                                    <Link 
                                      href={`/ministry/${ministry.id}`} 
                                      target="_blank"
                                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                      តេស្តមើលមុខងារ (Test)
                                    </Link>
                                    {autoSaving && <span className="text-sm font-medium text-slate-400 flex items-center gap-1"><div className="w-3 h-3 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" /> Auto-saving...</span>}
                                    <button
                                      onClick={handleSave}
                                      disabled={!!urlError || saving}
                                      className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20"
                                    >
                                      {saving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                      {saving ? 'Closing...' : (autoSaving ? 'Saving...' : 'Done')}
                                    </button>
                                  </div>
                              </div>
                              <div className="space-y-10">
                                {/* Basic Info */}
                                <section>
                                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-blue-600 rounded-full" />
                                    Basic Information
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                      <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ministry Name (Khmer)</label>
                                        <input 
                                          type="text" 
                                          value={editForm.khmerName}
                                          onChange={(e) => updateField('khmerName', e.target.value)}
                                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-bold text-lg"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ministry Name (English)</label>
                                        <input 
                                          type="text" 
                                          value={editForm.name}
                                          onChange={(e) => updateField('name', e.target.value)}
                                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ចំណាត់ថ្នាក់ (Group Type)</label>
                                        <select
                                          value={editForm.groupType || 'INSTITUTION'}
                                          onChange={(e) => updateField('groupType', e.target.value)}
                                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-khmer text-sm"
                                        >
                                          <option value="INSTITUTION">ក្រសួង ស្ថាប័ន (Institution)</option>
                                          <option value="SUBJECT">វិញ្ញាសា (Subject)</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Logo URL</label>
                                        <input 
                                          type="text" 
                                          value={editForm.logo}
                                          onChange={(e) => updateField('logo', e.target.value)}
                                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Color Theme</label>
                                        <input 
                                          type="text" 
                                          value={editForm.color}
                                          onChange={(e) => updateField('color', e.target.value)}
                                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Preview</label>
                                       <div className="aspect-video bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative">
                                          <SafeImage src={editForm.logo} alt="Preview" fill className="object-contain p-4" />
                                       </div>
                                    </div>
                                  </div>
                                </section>
                                {/* Detailed Info */}
                                <section>
                                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description / Details</label>
                                  <textarea 
                                    rows={6}
                                    value={editForm.details || editForm.description}
                                    onChange={(e) => updateField('details', e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                  />
                                </section>
                                {/* Terminology Section */}
                                <section>
                                  <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                      <div className="w-1 h-6 bg-emerald-500 rounded-full" />
                                      Terminology (ពន្យល់ពាក្យ)
                                    </h3>
                                    <button onClick={addTerm} className="flex items-center gap-1 text-sm font-bold text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-all">
                                      <Plus className="w-4 h-4" /> Add Term
                                    </button>
                                  </div>
                                  <div className="space-y-3">
                                    {editForm.terms?.map((term, idx) => (
                                      <div key={idx} className="flex gap-3 group">
                                        <input 
                                          type="text" 
                                          placeholder="Term"
                                          value={term.term}
                                          onChange={(e) => {
                                            const terms = [...(editForm.terms || [])];
                                            terms[idx].term = e.target.value;
                                            updateField('terms', terms);
                                          }}
                                          className="w-1/3 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 outline-none"
                                        />
                                        <input 
                                          type="text" 
                                          placeholder="Definition"
                                          value={term.definition}
                                          onChange={(e) => {
                                            const terms = [...(editForm.terms || [])];
                                            terms[idx].definition = e.target.value;
                                            updateField('terms', terms);
                                          }}
                                          className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 outline-none"
                                        />
                                        <button onClick={() => removeTerm(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </section>

                                {/* MCQs Section */}
                                <section>
                                   <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                      <div className="w-1 h-6 bg-purple-500 rounded-full" />
                                      Multiple Choice Questions (សំណួរពហុចម្លើយ)
                                    </h3>
                                    <button onClick={addMcqCategory} className="text-sm font-bold text-purple-600 px-3 py-1.5 rounded-lg transition-all">
                                      <Plus className="w-4 h-4 inline mr-1" /> Add Category
                                    </button>
                                  </div>
                                  <div className="space-y-6">
                                    <CategoryEditor
                                    categories={editForm.mcqs || []}
                                    updateParent={(newMcqs: AdminCategory[]) => updateField('mcqs', newMcqs as unknown as QuizCategory[])}
                                    type="mcq"
                                    onSendTelegram={(item, type, elementId, categoryName, itemNum) => {
                                      setSendingQuiz(item);
                                      setSendingQuizType(type);
                                      setSendingCategoryName(categoryName);
                                      setSendingItemNumber(itemNum || 1);
                                      const savedFmt = (typeof window !== 'undefined' && localStorage.getItem('vignasa_telegram_format') as 'POLL' | 'TEXT' | 'IMAGE') || 'TEXT';
                                      setTelegramFormat(savedFmt);
                                    }}
                                  />
                                  </div>
                                </section>

                                {/* QA Section */}
                                <section>
                                   <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                      <div className="w-1 h-6 bg-pink-500 rounded-full" />
                                      Short Answer Questions (សំណួរចម្លើយ)
                                    </h3>
                                    <button onClick={addQaCategory} className="text-sm font-bold text-pink-600 px-3 py-1.5 rounded-lg transition-all">
                                      <Plus className="w-4 h-4 inline mr-1" /> Add Category
                                    </button>
                                  </div>
                                  <div className="space-y-6">
                                    <CategoryEditor
                                    categories={editForm.shortAnswers || []}
                                    updateParent={(newQa: AdminCategory[]) => updateField('shortAnswers', newQa as unknown as ShortAnswerCategory[])}
                                    type="qa"
                                    onSendTelegram={(item, type, elementId, categoryName, itemNum) => {
                                      setSendingQuiz(item);
                                      setSendingQuizType(type);
                                      setSendingCategoryName(categoryName);
                                      setSendingItemNumber(itemNum || 1);
                                      const savedFmt = (typeof window !== 'undefined' && localStorage.getItem('vignasa_telegram_format') as 'POLL' | 'TEXT' | 'IMAGE') || 'TEXT';
                                      setTelegramFormat(savedFmt === 'POLL' ? 'TEXT' : savedFmt);
                                    }}
                                  />
                                  </div>
                                </section>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3.5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-3.5 sm:gap-6 overflow-hidden">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div {...provided.dragHandleProps} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing p-1 transition-colors shrink-0">
                                  <GripVertical className="w-5 h-5" />
                                </div>
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center p-1.5 sm:p-2 relative overflow-hidden">
                                  <SafeImage src={ministry.logo} alt="" fill className="object-contain p-1 sm:p-2" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-bold text-slate-800 text-base sm:text-lg truncate flex items-center gap-2">
                                    {ministry.khmerName}
                                    {ministry.groupType === 'SUBJECT' && (
                                      <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shrink-0">វិញ្ញាសា</span>
                                    )}
                                    {ministry.groupType !== 'SUBJECT' && (
                                      <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shrink-0">ក្រសួង</span>
                                    )}
                                  </h3>
                                  <p className="text-xs sm:text-sm text-slate-500 truncate">{ministry.name}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                <button
                                  onClick={() => handleEdit(ministry)}
                                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 bg-slate-50 text-slate-600 hover:text-blue-600 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl hover:bg-blue-50 transition-all font-bold text-xs sm:text-sm"
                                >
                                  <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  Edit Content
                                </button>
                                <button
                                  onClick={() => handleDeleteMinistry(ministry.id, ministry.khmerName)}
                                  className="flex-shrink-0 flex items-center justify-center p-2 sm:p-2.5 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          </DragDropContext>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">បញ្ជីសមាជិក ({usersInfo.length})</h2>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>កំពុង Online: {usersInfo.filter(u => getUserActivityStatus(u, currentTick).status === 'online').length} នាក់</span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-1">គ្រប់គ្រងគណនី សិទ្ធិ និងវត្តមានសកម្មភាពផ្ទាល់របស់សមាជិកទាំងអស់</p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Status Filter Tabs */}
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-bold">
                  <button
                    onClick={() => setUserStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${userStatusFilter === 'ALL' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    ទាំងអស់ ({usersInfo.length})
                  </button>
                  <button
                    onClick={() => setUserStatusFilter('ONLINE')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${userStatusFilter === 'ONLINE' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                    Online ({usersInfo.filter(u => getUserActivityStatus(u, currentTick).status === 'online').length})
                  </button>
                  <button
                    onClick={() => setUserStatusFilter('OFFLINE')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${userStatusFilter === 'OFFLINE' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Offline ({usersInfo.filter(u => getUserActivityStatus(u, currentTick).status !== 'online').length})
                  </button>
                </div>

                <div className="relative w-56">
                  <input 
                    placeholder="ស្វែងរកសមាជិក..." 
                    className="w-full text-xs font-medium rounded-xl px-3.5 py-2.5 border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs placeholder-slate-400"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-5 py-4 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest text-center w-14">No.</th>
                    <th className="px-5 py-4 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest">ឈ្មោះគណនី (Username)</th>
                    <th className="px-5 py-4 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest">វត្តមានសកម្មភាព (Status)</th>
                    <th className="px-5 py-4 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest">ស្ថានភាពសិទ្ធិ</th>
                    <th className="px-5 py-4 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest">ថ្ងៃចុះឈ្មោះ</th>
                    <th className="px-5 py-4 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody>
                  {usersInfo
                    .filter(u => {
                      const matchesSearch = u.username?.toLowerCase().includes(userSearchTerm.toLowerCase());
                      if (!matchesSearch) return false;
                      const status = getUserActivityStatus(u, currentTick).status;
                      if (userStatusFilter === 'ONLINE') return status === 'online';
                      if (userStatusFilter === 'OFFLINE') return status !== 'online';
                      return true;
                    })
                    .map((u: AdminUser, idx: number) => {
                      const statusInfo = getUserActivityStatus(u, currentTick);
                      return (
                        <tr key={u.uid || idx} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-5 py-4 border-b border-slate-100 text-sm text-slate-500 text-center font-medium">{idx + 1}</td>
                          <td className="px-5 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                              {/* User Avatar with Presence Indicator Dot */}
                              <div className="relative flex-shrink-0">
                                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                  <Users className="w-5 h-5" />
                                </div>
                                <span 
                                  title={`${statusInfo.khmerLabel} (${statusInfo.label})`}
                                  className={`absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-white ${statusInfo.dotColor}`}
                                >
                                  {statusInfo.status === 'online' && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  )}
                                </span>
                              </div>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-slate-900">
                                    {u.username}
                                  </p>
                                  {statusInfo.status === 'online' && (
                                    <span className="inline-flex items-center gap-1 bg-emerald-100/90 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-300 shadow-2xs">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      ONLINE
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {u.source === 'standard' && <span className="inline-flex items-center bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded text-[10px] tracking-wider">Google Auth</span>}
                                  {u.source === 'custom' && <span className="inline-flex items-center bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded text-[10px] tracking-wider">App Auth</span>}
                                  {u.role === 'ADMIN' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-red-600 tracking-wider bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                      <Shield className="w-3 h-3" /> Admin
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Presence Status Column */}
                          <td className="px-5 py-4 border-b border-slate-100">
                            <div className="flex flex-col gap-1">
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-xs w-fit ${statusInfo.badgeBg} ${statusInfo.badgeBorder} ${statusInfo.badgeText}`}>
                                <span className="relative flex h-2 w-2">
                                  {statusInfo.status === 'online' && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  )}
                                  <span className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.dotColor}`}></span>
                                </span>
                                <span>{statusInfo.khmerLabel}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium pl-1">
                                {statusInfo.subtitle}
                              </span>
                            </div>
                          </td>

                          {/* Membership Column */}
                          <td className="px-5 py-4 border-b border-slate-100">
                            {u.isPremium ? (
                              <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1 rounded-lg w-fit border border-amber-200">
                                <Crown className="w-4 h-4" /> <span className="text-xs font-bold tracking-widest">PREMIUM</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 px-3 py-1 rounded-lg w-fit border border-slate-200">
                                <span className="text-xs font-bold tracking-widest">NORMAL</span>
                              </div>
                            )}
                          </td>

                          {/* Registered Date Column */}
                          <td className="px-5 py-4 border-b border-slate-100 text-sm text-slate-600 font-medium">
                            {formatDateString(u.createdAt)}
                          </td>

                          {/* Actions Column */}
                          <td className="px-5 py-4 border-b border-slate-100 text-right">
                            {u.role !== 'ADMIN' && (
                              <div className="flex justify-end gap-2 items-center">
                                {u.isPremium ? (
                                  <button 
                                    onClick={() => handleRevokePremium(u)}
                                    className="h-9 px-4 text-xs font-bold uppercase tracking-widest rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-all flex items-center gap-2"
                                  >
                                    លុប Premium
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleGrantPremium(u)}
                                    className="h-9 px-4 text-xs font-bold uppercase tracking-widest rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md shadow-blue-600/20"
                                  >
                                    <Crown className="w-4 h-4" /> ផ្ដល់ Premium
                                  </button>
                                )}
                                <button
                                  onClick={() => handleResetPassword(u)}
                                  className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-200 transition-all"
                                  title="ប្តូរពាក្យសម្ងាត់"
                                >
                                  <Key className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="h-9 w-9 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 hover:border-red-200 transition-all"
                                  title="លុបគណនីសមាជិក"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {usersInfo.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">
                        មិនមានទិន្នន័យសមាជិក
                      </td>
                    </tr>
                  )}
                  {usersInfo.length > 0 && usersInfo.filter(u => {
                    const matchesSearch = u.username?.toLowerCase().includes(userSearchTerm.toLowerCase());
                    if (!matchesSearch) return false;
                    const status = getUserActivityStatus(u, currentTick).status;
                    if (userStatusFilter === 'ONLINE') return status === 'online';
                    if (userStatusFilter === 'OFFLINE') return status !== 'online';
                    return true;
                  }).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">
                        មិនមានសមាជិកត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* User Action Modal Dialog */}
      <AnimatePresence>
        {userActionDialog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">
                    {userActionDialog.type === 'GRANT_PREMIUM' && 'ផ្ដល់សិទ្ធិ Premium'}
                    {userActionDialog.type === 'REVOKE_PREMIUM' && 'លុបសិទ្ធិ Premium'}
                    {userActionDialog.type === 'DELETE_USER' && 'លុបគណនី'}
                    {userActionDialog.type === 'RESET_PASSWORD' && 'ប្តូរពាក្យសម្ងាត់'}
                  </h3>
                  <button onClick={() => setUserActionDialog(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {userActionDialog.type === 'GRANT_PREMIUM' && (
                    <p className="text-slate-600 text-sm">តើអ្នកពិតជាចង់ផ្ដល់សិទ្ធិ Premium ជាអចិន្ត្រៃយ៍ដល់គណនី &quot;{userActionDialog.username}&quot; មែនទេ?</p>
                  )}
                  {userActionDialog.type === 'REVOKE_PREMIUM' && (
                    <p className="text-slate-600 text-sm">តើអ្នកពិតជាចង់លុបសិទ្ធិ Premium ពីគណនី &quot;{userActionDialog.username}&quot; មែនទេ?</p>
                  )}
                  {userActionDialog.type === 'DELETE_USER' && (
                    <p className="text-slate-600 text-sm font-bold text-red-500">តើអ្នកពិតជាចង់លុបគណនី &quot;{userActionDialog.username}&quot; មែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។</p>
                  )}
                  {userActionDialog.type === 'RESET_PASSWORD' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">បញ្ចូលពាក្យសម្ងាត់ថ្មីសម្រាប់គណនី &quot;{userActionDialog.username}&quot;</label>
                      <input 
                        type="text" 
                        value={newPasswordValue}
                        onChange={(e) => setNewPasswordValue(e.target.value)}
                        className="w-full h-11 px-4 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="ពាក្យសម្ងាត់ថ្មី"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-8 flex gap-3 justify-end border-t border-slate-100 pt-6">
                  <button onClick={() => setUserActionDialog(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
                    បោះបង់
                  </button>
                  <button 
                    onClick={confirmUserAction}
                    disabled={userActionDialog.type === 'RESET_PASSWORD' && (!newPasswordValue || newPasswordValue.trim().length === 0)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 ${userActionDialog.type === 'DELETE_USER' || userActionDialog.type === 'REVOKE_PREMIUM' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    បញ្ជាក់
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telegram Sending Modal Dialog */}
      <AnimatePresence>
        {sendingQuiz && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto border border-slate-100 relative space-y-4"
            >
              {/* Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">ផ្ញើសំណួរទៅកាន់ Telegram</h4>
                  <p className="text-[10px] text-slate-400 font-medium">បង្ហោះសំណួរទៅឆានែល ឬគ្រុប Telegram ភ្លាមៗ</p>
                </div>
                <button 
                  onClick={handleCloseTelegramModal}
                  className="ml-auto p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Question Summary */}
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-blue-600">សំណួរ៖</span>
                <p className="text-xs font-bold text-slate-700 line-clamp-2 leading-relaxed">{sendingQuiz.question}</p>
              </div>

              {/* Form Field: Chat ID */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Telegram Chat ID (ID គ្រុប ឬឆានែល)</label>
                <input 
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="ឧទាហរណ៍៖ -100123456789 ឬ @channelname"
                  className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all font-semibold text-slate-800 placeholder-slate-400"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[
                    { label: "Web QCM Q & A", val: "@web_qcm_q_and_a" },
                    { label: "Naret26", val: "@Naret26" },
                    { label: "TheAdvisor26", val: "@theAdvisor26" },
                    { label: "Family of Law", val: "@familyoflaw" },
                    { label: "Khmer Family of Law", val: "@khmerfamilyoflaw" },
                    { label: "User (700259660)", val: "700259660" }
                  ].map(t => (
                    <button 
                      key={t.val}
                      type="button"
                      onClick={() => setTelegramChatId(t.val)}
                      className="px-2 py-1 text-[10px] font-extrabold bg-slate-50 border border-slate-100 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Universal Question Item Number Customization */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                      <Hash className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-slate-800 font-khmer">លេខរៀងសំណួរ (Sequence Number)</h5>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {includeItemNumber 
                          ? `ដាក់បញ្ចូលលេខរៀង៖ សំណួរទី ${sendingItemNumber} (Include sequence)` 
                          : "មិនដាក់លេខរៀងពេលផ្ញើ (No sequence number)"}
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={includeItemNumber}
                      onChange={(e) => {
                        setIncludeItemNumber(e.target.checked);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('vignasa_include_sequence_number', String(e.target.checked));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] font-bold text-slate-700 font-khmer">
                      {includeItemNumber ? "ដាក់លេខរៀង" : "មិនដាក់លេខរៀង"}
                    </span>
                  </label>
                </div>

                {includeItemNumber && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[10.5px] font-medium text-slate-500 font-khmer">ជ្រើសរើសលេខរៀងសំណួរ៖</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSendingItemNumber(Math.max(1, sendingItemNumber - 1))}
                        className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
                      >
                        -
                      </button>
                      <div className="flex items-center px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-xs text-slate-500 font-khmer font-bold mr-1">សំណួរទី</span>
                        <input
                          type="number"
                          min="1"
                          value={sendingItemNumber}
                          onChange={(e) => setSendingItemNumber(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-12 text-center font-black text-xs outline-none bg-transparent text-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSendingItemNumber(sendingItemNumber + 1)}
                        className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Field: Format Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">ជ្រើសរើសទម្រង់ផ្ញើ (Sending Format)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTelegramFormat('POLL');
                      if (typeof window !== 'undefined') localStorage.setItem('vignasa_telegram_format', 'POLL');
                    }}
                    disabled={sendingQuizType !== 'mcq'}
                    className={`py-2 px-1 text-[11px] font-extrabold rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      telegramFormat === 'POLL' 
                        ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' 
                        : sendingQuizType !== 'mcq'
                          ? 'bg-slate-50 border-slate-150 text-slate-300 cursor-not-allowed opacity-50'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">🗳️</span>
                    <span>ទម្រង់ Poll</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTelegramFormat('TEXT');
                      if (typeof window !== 'undefined') localStorage.setItem('vignasa_telegram_format', 'TEXT');
                    }}
                    className={`py-2 px-1 text-[11px] font-extrabold rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      telegramFormat === 'TEXT' 
                        ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">📝</span>
                    <span>ទម្រង់ Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTelegramFormat('IMAGE');
                      if (typeof window !== 'undefined') localStorage.setItem('vignasa_telegram_format', 'IMAGE');
                    }}
                    className={`py-2 px-1 text-[11px] font-extrabold rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      telegramFormat === 'IMAGE' 
                        ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm ring-1 ring-blue-500/30' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">🖼️</span>
                    <span>ទម្រង់ Image Poster</span>
                  </button>
                </div>
                {sendingQuizType !== 'mcq' && (
                  <p className="text-[9px] text-amber-600 font-medium leading-relaxed">
                    * សំណួរប្រភេទចម្លើយខ្លី (Q&A) មិនអាចផ្ញើជាទម្រង់ Poll បានទេ។
                  </p>
                )}
              </div>

              {/* Text Submission Customization (When format is TEXT) */}
              {telegramFormat === 'TEXT' && (
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3 text-left">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                    <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-slate-800 font-khmer">ការកំណត់សារអត្ថបទ (Text Quiz Options)</h5>
                      <p className="text-[10px] text-slate-400 font-medium">កំណត់ចម្លើយ (A, B, C, D) លេខរៀងសំណួរ និងពិនិត្យគំរូសារ</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Include Correct Answer Toggle */}
                    <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 text-slate-800 text-xs font-bold font-khmer cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={textIncludeAnswer}
                        onChange={(e) => {
                          setTextIncludeAnswer(e.target.checked);
                          if (typeof window !== 'undefined') localStorage.setItem('vignasa_text_show_answer', String(e.target.checked));
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span>👉</span>
                          <span>ផ្តល់ចម្លើយត្រឹមត្រូវ (Provide Correct Answer A, B, C, D)</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5 font-khmer">
                          បង្ហាញចម្លើយត្រឹមត្រូវក្នុងសារ Telegram
                        </p>
                      </div>
                    </label>

                    {/* Answer Choice Style: Letter only (A, B, C, D) vs Full Text */}
                    {textIncludeAnswer && sendingQuizType === 'mcq' && (
                      <div className="ml-4 p-2.5 bg-slate-100/80 rounded-xl space-y-1.5 text-xs font-khmer">
                        <span className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wider block">ទម្រង់ចម្លើយពហុជ្រើសរើស (Answer Format)៖</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setTextAnswerChoiceOnly(true);
                              if (typeof window !== 'undefined') localStorage.setItem('vignasa_text_choice_only', 'true');
                            }}
                            className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                              textAnswerChoiceOnly
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-[11px] font-black">តែអក្សរចម្លើយ (A, B, C, D)</div>
                            <div className="text-[9px] opacity-80 mt-0.5">ឧ. ចម្លើយ៖ A</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTextAnswerChoiceOnly(false);
                              if (typeof window !== 'undefined') localStorage.setItem('vignasa_text_choice_only', 'false');
                            }}
                            className={`p-2 rounded-lg border text-left cursor-pointer transition-all ${
                              !textAnswerChoiceOnly
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="text-[11px] font-black">អក្សរ + ខ្លឹមសារ</div>
                            <div className="text-[9px] opacity-80 mt-0.5">ឧ. ចម្លើយ៖ A (ខ្លឹមសារ)</div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Telegram Spoiler Toggle */}
                    {textIncludeAnswer && (
                      <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 text-slate-800 text-xs font-bold font-khmer cursor-pointer hover:bg-slate-50 transition-colors ml-4">
                        <input
                          type="checkbox"
                          checked={textUseSpoiler}
                          onChange={(e) => {
                            setTextUseSpoiler(e.target.checked);
                            if (typeof window !== 'undefined') localStorage.setItem('vignasa_text_use_spoiler', String(e.target.checked));
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span>🫣</span>
                            <span>លាក់ចម្លើយដោយប្រើ Telegram Spoiler (&lt;tg-spoiler&gt;)</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5 font-khmer">
                            តម្រូវឱ្យចុចលើចម្លើយដើម្បីមើល (Tap to reveal answer)
                          </p>
                        </div>
                      </label>
                    )}

                    {/* Header Toggle (Omitted by default) */}
                    <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 text-slate-800 text-xs font-bold font-khmer cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={textIncludeHeader}
                        onChange={(e) => {
                          setTextIncludeHeader(e.target.checked);
                          if (typeof window !== 'undefined') localStorage.setItem('vignasa_text_show_header', String(e.target.checked));
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span>🏛️</span>
                          <span>រួមបញ្ចូលក្បាលសារស្ថាប័ន (Title & Subject Header)</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5 font-khmer">
                          បិទ (Default Omitted)៖ មិនបញ្ចូល &quot;🏛️ កម្មវិធីត្រៀមប្រឡង... / 📚 វិញ្ញាសា...&quot; ឡើយ (No need to include this part)
                        </p>
                      </div>
                    </label>

                    {/* Include Explanation Toggle */}
                    <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 text-slate-800 text-xs font-bold font-khmer cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={textIncludeExplanation}
                        onChange={(e) => {
                          setTextIncludeExplanation(e.target.checked);
                          if (typeof window !== 'undefined') localStorage.setItem('vignasa_text_show_exp', String(e.target.checked));
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span>💡</span>
                          <span>បង្ហាញការពន្យល់ និងឯកសារយោង (Provide Explanation)</span>
                        </div>
                      </div>
                    </label>

                    {/* Live Text Preview Box */}
                    <div className="p-3 bg-slate-900 rounded-xl text-left border border-slate-800 space-y-1.5 mt-3">
                      <div className="flex items-center justify-between text-slate-300 text-[10.5px] font-bold font-khmer">
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                          <span>គំរូសារ Telegram ជាក់ស្តែង (Live Preview)</span>
                        </span>
                        <span className="text-[9px] text-emerald-400 font-semibold">
                          {textIncludeHeader ? 'មានក្បាលសារស្ថាប័ន' : 'គ្មានក្បាលសារស្ថាប័ន (Omitted)'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-950 rounded-lg text-xs font-khmer text-slate-200 whitespace-pre-wrap leading-relaxed select-text border border-slate-800/80 font-normal max-h-48 overflow-y-auto">
                        {getLiveTextPreview()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Poster Layout & Footer Customization (Only when format is IMAGE) */}
              {telegramFormat === 'IMAGE' && (
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4 text-left">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                        <Palette className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-800 font-khmer">រចនាប័ទ្ម Poster & Footer (Modern Poster)</h5>
                        <p className="text-[10px] text-slate-400 font-medium">កែសម្រួលផ្ទៃ Poster និងព័ត៌មានខាងក្រោមមុននឹងបង្ហោះ</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGeneratePosterPreview()}
                      disabled={isPreviewingPoster}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold shadow-2xs transition-all cursor-pointer font-khmer"
                    >
                      {isPreviewingPoster ? (
                        <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>{posterPreviewUrl ? 'បង្កើតគំរូឡើងវិញ' : 'មើលគំរូរូបភាព'}</span>
                    </button>
                  </div>

                  {/* 1. Layout Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block font-khmer">
                      ជ្រើសរើសស្ទីល Poster (Layout Style)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPosterLayout('MODERN_DARK');
                          savePosterConfig('MODERN_DARK', posterFooterBrand, posterFooterTagline, posterFooterHandle, posterShowAnswer, posterShowExplanation);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          posterLayout === 'MODERN_DARK'
                            ? 'bg-[#092C44] text-white border-amber-400 shadow-md ring-2 ring-amber-400/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs">🌟</span>
                          {posterLayout === 'MODERN_DARK' && <span className="text-[9px] bg-amber-400 text-slate-900 font-black px-1.5 py-0.2 rounded">សកម្ម</span>}
                        </div>
                        <div className="text-[11px] font-black font-khmer leading-tight">Modern Dark</div>
                        <div className="text-[9px] opacity-70 font-khmer mt-0.5">ផ្ទៃងងឹត + ពណ៌មាស</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPosterLayout('EDITORIAL_LIGHT');
                          savePosterConfig('EDITORIAL_LIGHT', posterFooterBrand, posterFooterTagline, posterFooterHandle, posterShowAnswer, posterShowExplanation);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          posterLayout === 'EDITORIAL_LIGHT'
                            ? 'bg-white text-blue-900 border-blue-600 shadow-md ring-2 ring-blue-600/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs">📄</span>
                          {posterLayout === 'EDITORIAL_LIGHT' && <span className="text-[9px] bg-blue-600 text-white font-black px-1.5 py-0.2 rounded">សកម្ម</span>}
                        </div>
                        <div className="text-[11px] font-black font-khmer leading-tight">Editorial Light</div>
                        <div className="text-[9px] opacity-70 font-khmer mt-0.5">ផ្ទៃសស្អាត + បែបកាសែត</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPosterLayout('ROYAL_GOLD');
                          savePosterConfig('ROYAL_GOLD', posterFooterBrand, posterFooterTagline, posterFooterHandle, posterShowAnswer, posterShowExplanation);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          posterLayout === 'ROYAL_GOLD'
                            ? 'bg-[#093754] text-amber-200 border-amber-300 shadow-md ring-2 ring-amber-300/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs">👑</span>
                          {posterLayout === 'ROYAL_GOLD' && <span className="text-[9px] bg-amber-300 text-slate-900 font-black px-1.5 py-0.2 rounded">សកម្ម</span>}
                        </div>
                        <div className="text-[11px] font-black font-khmer leading-tight">Royal Gold</div>
                        <div className="text-[9px] opacity-70 font-khmer mt-0.5">ខៀវរាជវាំង + ក្បាច់មាស</div>
                      </button>
                    </div>
                  </div>

                  {/* 2. Program Logo Option */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-slate-800 text-xs font-bold font-khmer cursor-pointer">
                        <input
                          type="checkbox"
                          checked={posterIncludeProgramLogo}
                          onChange={(e) => {
                            setPosterIncludeProgramLogo(e.target.checked);
                            savePosterConfig(
                              posterLayout, 
                              posterFooterBrand, 
                              posterFooterTagline, 
                              posterFooterHandle, 
                              posterShowAnswer, 
                              posterShowExplanation,
                              e.target.checked,
                              posterProgramLogo
                            );
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span>បញ្ចូលឡូហ្គោកម្មវិធីលើ Poster (Program Logo)</span>
                      </label>
                      <div className="w-6 h-6 rounded-full border border-amber-300 overflow-hidden relative bg-white shadow-2xs flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={posterProgramLogo || "https://i.ibb.co/FkGwqJVL/3-QCM-Ep4-1.jpg"} 
                          alt="Program Logo Preview" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    </div>
                    {posterIncludeProgramLogo && (
                      <div className="pt-1">
                        <span className="text-[9.5px] font-bold text-slate-400 block font-khmer mb-1">តំណភ្ជាប់ឡូហ្គោកម្មវិធី (Program Logo URL)</span>
                        <input
                          type="text"
                          value={posterProgramLogo}
                          onChange={(e) => {
                            setPosterProgramLogo(e.target.value);
                            savePosterConfig(
                              posterLayout, 
                              posterFooterBrand, 
                              posterFooterTagline, 
                              posterFooterHandle, 
                              posterShowAnswer, 
                              posterShowExplanation,
                              posterIncludeProgramLogo,
                              e.target.value
                            );
                          }}
                          placeholder="https://..."
                          className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-500 outline-none font-medium text-slate-700"
                        />
                      </div>
                    )}
                  </div>

                  {/* 3. Image Content Mode (Question Only vs Both Question & Answer) */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block font-khmer">
                      ខ្លឹមសារក្នុងរូបភាព (Image Content Mode)
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPosterShowAnswer(true);
                          savePosterConfig(
                            posterLayout, 
                            posterFooterBrand, 
                            posterFooterTagline, 
                            posterFooterHandle, 
                            true, 
                            posterShowExplanation,
                            posterIncludeProgramLogo,
                            posterProgramLogo
                          );
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          posterShowAnswer
                            ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-black text-xs font-khmer mb-1">
                          <span>🌟</span>
                          <span>មានទាំងសំណួរ និងចម្លើយ</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-khmer leading-snug">
                          រូបភាព Poster បង្ហាញសំណួរ ចម្លើយត្រឹមត្រូវ (Highlight Answer) និងការពន្យល់។
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPosterShowAnswer(false);
                          savePosterConfig(
                            posterLayout, 
                            posterFooterBrand, 
                            posterFooterTagline, 
                            posterFooterHandle, 
                            false, 
                            posterShowExplanation,
                            posterIncludeProgramLogo,
                            posterProgramLogo
                          );
                        }}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          !posterShowAnswer
                            ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-xs ring-1 ring-amber-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-black text-xs font-khmer mb-1">
                          <span>❓</span>
                          <span>មានតែសំណួរប៉ុណ្ណោះ (Question Only)</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-khmer leading-snug">
                          រូបភាពមានតែសំណួរ • ចម្លើយ និងការពន្យល់នឹងត្រូវផ្ញើជាអត្ថបទ (Text alongside image)។
                        </p>
                      </button>
                    </div>

                    {!posterShowAnswer ? (
                      <div className="space-y-2">
                        <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/80 text-[10.5px] text-amber-800 font-khmer flex items-start gap-2">
                          <span className="text-sm mt-0.5">💡</span>
                          <span className="leading-relaxed">
                            <b>ការរៀបចំស្វ័យប្រវត្តិ៖</b> ផ្ទាំងរូបភាពនឹងមានតែសំណួរ (មិនបង្ហាញចម្លើយ)។ ប្រព័ន្ធនឹងរៀបចំសំណួរ ជម្រើស និងចម្លើយត្រឹមត្រូវ (Telegram Spoiler) ព្រមទាំងការពន្យល់លម្អិត ជាអត្ថបទផ្ញើភ្ជាប់ជាមួយរូបភាពភ្លាមៗ!
                          </span>
                        </div>

                        {/* Companion Text Live Preview */}
                        <div className="p-3 bg-slate-900 rounded-xl text-left border border-slate-800 space-y-1.5 mt-2">
                          <div className="flex items-center justify-between text-slate-300 text-[10.5px] font-bold font-khmer">
                            <span className="flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                              <span>អត្ថបទផ្ញើភ្ជាប់ជាមួយរូបភាព (Text alongside image)</span>
                            </span>
                            <span className="text-[9px] text-emerald-400 font-semibold">គ្មានក្បាលសារស្ថាប័ន</span>
                          </div>
                          <div className="p-2.5 bg-slate-950 rounded-lg text-xs font-khmer text-slate-200 whitespace-pre-wrap leading-relaxed select-text border border-slate-800/80 font-normal max-h-36 overflow-y-auto">
                            {getLiveTextPreview()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-slate-700 text-xs font-bold font-khmer cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={posterShowExplanation}
                          onChange={(e) => {
                            setPosterShowExplanation(e.target.checked);
                            savePosterConfig(
                              posterLayout, 
                              posterFooterBrand, 
                              posterFooterTagline, 
                              posterFooterHandle, 
                              posterShowAnswer, 
                              e.target.checked,
                              posterIncludeProgramLogo,
                              posterProgramLogo
                            );
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span>បង្ហាញប្រអប់ការពន្យល់/ឯកសារយោងលើផ្ទាំងរូបភាព Poster</span>
                      </label>
                    )}
                  </div>

                  {/* 4. Text Position & Alignment Customization */}
                  <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                        <Type className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-800 font-khmer">ទីតាំង និងតម្រឹមអត្ថបទលើរូបភាព (Text Position & Alignment)</h5>
                        <p className="text-[10px] text-slate-400 font-medium font-khmer">កំណត់ទីតាំងសំណួរ តម្រឹមអក្សរ និងទីតាំងបញ្ឈរក្នុងផ្ទាំងរូបភាព Poster</p>
                      </div>
                    </div>

                    {/* Question Text Horizontal Alignment */}
                    <div className="space-y-1.5">
                      <span className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wider block font-khmer">
                        តម្រឹមសំណួរ (Question Text Alignment)
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { id: 'left', label: 'ឆ្វេង (Left)', icon: AlignLeft },
                          { id: 'center', label: 'កណ្តាល (Center)', icon: AlignCenter },
                          { id: 'right', label: 'ស្តាំ (Right)', icon: AlignRight },
                          { id: 'justify', label: 'ពេញបន្ទាត់ (Justify)', icon: AlignJustify }
                        ].map((item) => {
                          const IconComponent = item.icon;
                          const isSelected = posterTextAlign === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                const val = item.id as 'left' | 'center' | 'right' | 'justify';
                                setPosterTextAlign(val);
                                savePosterConfig(
                                  posterLayout,
                                  posterFooterBrand,
                                  posterFooterTagline,
                                  posterFooterHandle,
                                  posterShowAnswer,
                                  posterShowExplanation,
                                  posterIncludeProgramLogo,
                                  posterProgramLogo,
                                  val,
                                  posterVerticalAlign,
                                  posterOptionsAlign,
                                  posterFontSize
                                );
                                if (posterPreviewUrl) {
                                  handleGeneratePosterPreview({ textAlign: val });
                                }
                              }}
                              className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <IconComponent className="w-3.5 h-3.5" />
                              <span className="text-[9.5px] font-khmer leading-tight">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Content Vertical Position */}
                    <div className="space-y-1.5">
                      <span className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wider block font-khmer">
                        ទីតាំងបញ្ឈរក្នុងរូបភាព (Vertical Placement)
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'top', label: 'ខាងលើ (Top)', desc: 'តម្រឹមខាងលើ', icon: ArrowUpToLine },
                          { id: 'center', label: 'កណ្តាល (Middle)', desc: 'ចំកណ្តាលផ្ទាំង', icon: MoveVertical },
                          { id: 'bottom', label: 'ខាងក្រោម (Bottom)', desc: 'តម្រឹមខាងក្រោម', icon: ArrowDownToLine }
                        ].map((item) => {
                          const IconComponent = item.icon;
                          const isSelected = posterVerticalAlign === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                const val = item.id as 'top' | 'center' | 'bottom';
                                setPosterVerticalAlign(val);
                                savePosterConfig(
                                  posterLayout,
                                  posterFooterBrand,
                                  posterFooterTagline,
                                  posterFooterHandle,
                                  posterShowAnswer,
                                  posterShowExplanation,
                                  posterIncludeProgramLogo,
                                  posterProgramLogo,
                                  posterTextAlign,
                                  val,
                                  posterOptionsAlign,
                                  posterFontSize
                                );
                                if (posterPreviewUrl) {
                                  handleGeneratePosterPreview({ verticalAlign: val });
                                }
                              }}
                              className={`py-2 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <IconComponent className="w-3.5 h-3.5" />
                              <div className="text-[10px] font-khmer font-bold">{item.label}</div>
                              <div className={`text-[8.5px] font-khmer ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{item.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Options Alignment & Question Font Size Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
                      {/* Options Alignment */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block font-khmer">
                          តម្រឹមជម្រើសចម្លើយ (Options)
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          {[
                            { id: 'left', label: 'ឆ្វេង (Left)' },
                            { id: 'center', label: 'កណ្តាល (Center)' }
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                const val = opt.id as 'left' | 'center';
                                setPosterOptionsAlign(val);
                                savePosterConfig(
                                  posterLayout,
                                  posterFooterBrand,
                                  posterFooterTagline,
                                  posterFooterHandle,
                                  posterShowAnswer,
                                  posterShowExplanation,
                                  posterIncludeProgramLogo,
                                  posterProgramLogo,
                                  posterTextAlign,
                                  posterVerticalAlign,
                                  val,
                                  posterFontSize
                                );
                                if (posterPreviewUrl) {
                                  handleGeneratePosterPreview({ optionsAlign: val });
                                }
                              }}
                              className={`py-1.5 px-1 rounded-lg border text-[9.5px] font-khmer font-bold transition-all cursor-pointer ${
                                posterOptionsAlign === opt.id
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Question Font Size */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block font-khmer">
                          ទំហំអក្សរសំណួរ (Font Size)
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { id: 'small', label: 'តូច' },
                            { id: 'medium', label: 'មធ្យម' },
                            { id: 'large', label: 'ធំ' }
                          ].map((fs) => (
                            <button
                              key={fs.id}
                              type="button"
                              onClick={() => {
                                const val = fs.id as 'small' | 'medium' | 'large';
                                setPosterFontSize(val);
                                savePosterConfig(
                                  posterLayout,
                                  posterFooterBrand,
                                  posterFooterTagline,
                                  posterFooterHandle,
                                  posterShowAnswer,
                                  posterShowExplanation,
                                  posterIncludeProgramLogo,
                                  posterProgramLogo,
                                  posterTextAlign,
                                  posterVerticalAlign,
                                  posterOptionsAlign,
                                  val
                                );
                                if (posterPreviewUrl) {
                                  handleGeneratePosterPreview({ fontSize: val });
                                }
                              }}
                              className={`py-1.5 px-1 rounded-lg border text-[9.5px] font-khmer font-bold transition-all cursor-pointer ${
                                posterFontSize === fs.id
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {fs.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Footer Customization */}
                  <div className="space-y-2 pt-1 border-t border-slate-200/60">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block font-khmer">
                      កែសម្រួល Footer ខាងក្រោម Poster
                    </label>
                    
                    <div className="space-y-1.5">
                      <span className="text-[9.5px] font-bold text-slate-500 font-khmer">ឈ្មោះម៉ាក / ស្ថាប័ន (Footer Brand Title)</span>
                      <input
                        type="text"
                        value={posterFooterBrand}
                        onChange={(e) => {
                          setPosterFooterBrand(e.target.value);
                          savePosterConfig(posterLayout, e.target.value, posterFooterTagline, posterFooterHandle, posterShowAnswer, posterShowExplanation);
                        }}
                        placeholder="ឧ. Master Quiz KH • វិញ្ញាសាផ្លូវការ"
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-semibold text-slate-800"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9.5px] font-bold text-slate-500 font-khmer">ពាក្យស្លោក / ការណែនាំ (Footer Subtitle / Tagline)</span>
                      <input
                        type="text"
                        value={posterFooterTagline}
                        onChange={(e) => {
                          setPosterFooterTagline(e.target.value);
                          savePosterConfig(posterLayout, posterFooterBrand, e.target.value, posterFooterHandle, posterShowAnswer, posterShowExplanation);
                        }}
                        placeholder="ឧ. កម្មវិធីត្រៀមប្រឡងក្របខ័ណ្ឌរដ្ឋ និងស្ថាប័នសាធារណៈ"
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-semibold text-slate-800"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9.5px] font-bold text-slate-500 font-khmer">Telegram Handle / Bot (Footer Tag Badge)</span>
                      <input
                        type="text"
                        value={posterFooterHandle}
                        onChange={(e) => {
                          setPosterFooterHandle(e.target.value);
                          savePosterConfig(posterLayout, posterFooterBrand, posterFooterTagline, e.target.value, posterShowAnswer, posterShowExplanation);
                        }}
                        placeholder="ឧ. @qiuzs_bot"
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none font-semibold text-slate-800"
                      />
                      <div className="flex flex-wrap gap-1 mt-1">
                        {['@qiuzs_bot', '@web_qcm_q_and_a', '@Naret26', '@familyoflaw', '@khmerfamilyoflaw'].map(handle => (
                          <button
                            key={handle}
                            type="button"
                            onClick={() => {
                              setPosterFooterHandle(handle);
                              savePosterConfig(posterLayout, posterFooterBrand, posterFooterTagline, handle, posterShowAnswer, posterShowExplanation);
                            }}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md border transition-colors cursor-pointer ${
                              posterFooterHandle === handle
                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {handle}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 4. Live Poster Preview Window */}
                  {posterPreviewUrl && (
                    <div className="mt-3 p-3 bg-slate-900 rounded-2xl space-y-2 border border-slate-800">
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-1.5 text-xs font-bold font-khmer">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>រូបភាពគំរូ Poster ជាក់ស្តែង (Actual Poster Preview)</span>
                        </div>
                        <a
                          href={posterPreviewUrl}
                          download={`poster_${Date.now()}.png`}
                          className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200 underline font-khmer"
                        >
                          <Download className="w-3 h-3" />
                          <span>ទាញយក PNG</span>
                        </a>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-slate-700 max-h-60 overflow-y-auto bg-slate-950 flex justify-center p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={posterPreviewUrl} 
                          alt="Poster Preview" 
                          className="w-full max-w-sm rounded-lg object-contain shadow-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Progress / Error Reporting */}
              {telegramProgress && (
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50 animate-pulse">
                  <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                  <span>{telegramProgress}</span>
                </div>
              )}
              {telegramError && (
                <div className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-150 leading-relaxed">
                  {telegramError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCloseTelegramModal}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer font-khmer"
                >
                  បោះបង់
                </button>
                <button
                  type="button"
                  onClick={handleSendTelegramQuiz}
                  disabled={isSendingTelegram || !telegramChatId}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer font-khmer"
                >
                  {isSendingTelegram ? 'កំពុងផ្ញើ...' : 'ផ្ញើទៅ Telegram'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

