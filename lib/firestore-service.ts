import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  deleteDoc,
  serverTimestamp,
  getDocFromServer,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Ministry, Progress, UserRole, PdfDocument } from './types';

const MINISTRIES_COLLECTION = 'ministries';
const USERS_COLLECTION = 'users';

// The hardcoded system admin email
const SYSTEM_ADMIN_EMAIL = 'khuonnaret17@mekong.edu.kh';


enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const errorString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorString);
  throw new Error(errorString);
}

// In-memory cache for high-speed instant data retrieval
let cachedMinistries: Ministry[] | null = null;
let lastMinistriesFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute in-memory TTL

let cachedDocuments: PdfDocument[] | null = null;
const cachedMinistryDocuments = new Map<string, { data: PdfDocument[]; timestamp: number }>();

// Presence write throttler to prevent spamming Firestore writes
const lastPresenceWriteMap = new Map<string, number>();
const PRESENCE_THROTTLE_MS = 30000; // write at most once every 30 seconds per user unless offline

export const firestoreService = {
  // --- Documents ---
  async getDocuments(force = false): Promise<PdfDocument[]> {
    if (!force && cachedDocuments && (Date.now() - lastMinistriesFetchTime < CACHE_TTL_MS)) {
      return cachedDocuments;
    }
    try {
      const querySnapshot = await getDocs(collection(db, 'documents'));
      const data = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PdfDocument));
      cachedDocuments = data;
      return data;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'documents');
      return cachedDocuments || [];
    }
  },

  async getDocumentsByMinistry(ministryId: string, force = false): Promise<PdfDocument[]> {
    const cached = cachedMinistryDocuments.get(ministryId);
    if (!force && cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }
    try {
      const q = query(collection(db, 'documents'), where('ministryId', '==', ministryId));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PdfDocument));
      cachedMinistryDocuments.set(ministryId, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `documents for ministry ${ministryId}`);
      return cached ? cached.data : [];
    }
  },

  // --- Ministries ---
  async getMinistries(force = false): Promise<Ministry[]> {
    const now = Date.now();
    if (!force && cachedMinistries && (now - lastMinistriesFetchTime < CACHE_TTL_MS)) {
      return cachedMinistries;
    }

    // Try localStorage if in browser and memory cache is empty
    if (!force && !cachedMinistries && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('vignasa_ministries_cache');
        if (stored) {
          cachedMinistries = JSON.parse(stored);
          lastMinistriesFetchTime = now;
          return cachedMinistries!;
        }
      } catch {}
    }

    try {
      const querySnapshot = await getDocs(collection(db, MINISTRIES_COLLECTION));
      const ministries = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Ministry))
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      cachedMinistries = ministries;
      lastMinistriesFetchTime = Date.now();
      return ministries;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, MINISTRIES_COLLECTION);
      return cachedMinistries || []; // fallback to cached if error
    }
  },

  subscribeMinistries(callback: (ministries: Ministry[]) => void, onError?: (error: unknown) => void) {
    return onSnapshot(collection(db, MINISTRIES_COLLECTION), (snapshot) => {
      const ministries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Ministry))
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      cachedMinistries = ministries;
      lastMinistriesFetchTime = Date.now();
      callback(ministries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, MINISTRIES_COLLECTION);
      if (onError) onError(error);
    });
  },

  async saveMinistry(ministry: Ministry) {
    cachedMinistries = null; // Invalidate cache
    const docRef = doc(db, MINISTRIES_COLLECTION, ministry.id);
    try {
      await setDoc(docRef, {
        ...ministry,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${MINISTRIES_COLLECTION}/${ministry.id}`);
    }
  },

  async deleteMinistry(id: string) {
    cachedMinistries = null; // Invalidate cache
    try {
      await deleteDoc(doc(db, MINISTRIES_COLLECTION, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${MINISTRIES_COLLECTION}/${id}`);
    }
  },

  async updateMinistryOrders(updates: { id: string; order: number }[]) {
    cachedMinistries = null; // Invalidate cache
    try {
      const batch = writeBatch(db);
      updates.forEach(({ id, order }) => {
        const docRef = doc(db, MINISTRIES_COLLECTION, id);
        batch.set(docRef, { order, updatedAt: serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, MINISTRIES_COLLECTION);
    }
  },

  // --- Users & Roles ---
  async syncUserSession(uid: string, email: string, requestedRole?: UserRole | null, adminAccess: boolean = false) {
    const userRef = doc(db, USERS_COLLECTION, uid);
    try {
      const userDoc = await getDoc(userRef);
      
      // Determine role based on email if it's the system admin OR if they have validated admin access
      const isSystemAdmin = email.toLowerCase() === SYSTEM_ADMIN_EMAIL.toLowerCase();
      const shouldBeAdmin = isSystemAdmin || adminAccess;
      
      let dbRole: UserRole = 'MEMBER';

      if (userDoc.exists()) {
        dbRole = userDoc.data()?.role as UserRole;
        
        if (shouldBeAdmin && dbRole !== 'ADMIN') {
          await setDoc(userRef, { 
            role: 'ADMIN', 
            isOnline: true,
            lastActiveAt: serverTimestamp(),
            updatedAt: serverTimestamp() 
          }, { merge: true });
          dbRole = 'ADMIN';
        } else {
          await setDoc(userRef, { 
            isOnline: true,
            lastActiveAt: serverTimestamp(),
            updatedAt: serverTimestamp() 
          }, { merge: true });
        }
      } else {
        // NEW USER: Default to MEMBER unless should be admin
        dbRole = shouldBeAdmin ? 'ADMIN' : 'MEMBER';

        await setDoc(userRef, {
          uid,
          email,
          role: dbRole,
          progress: {},
          isOnline: true,
          lastActiveAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // If user is an ADMIN in DB, they can preview as MEMBER if they requested it
      const finalRole = (dbRole === 'ADMIN') ? (requestedRole || 'ADMIN') : 'MEMBER';
      
      console.log(`[Role Sync] Email: ${email}, DB Role: ${dbRole}, Requested: ${requestedRole}, Final: ${finalRole}`);
      
      return finalRole;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${USERS_COLLECTION}/${uid}`);
      return 'MEMBER';
    }
  },

  async getUserRole(uid: string): Promise<UserRole | null> {
    const userRef = doc(db, USERS_COLLECTION, uid);
    try {
      const userDoc = await getDoc(userRef);
      return userDoc.exists() ? (userDoc.data().role as UserRole) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${USERS_COLLECTION}/${uid}`);
      return null;
    }
  },

  // --- User Progress ---
  async getProgress(userId: string): Promise<Progress> {
    const userRef = doc(db, USERS_COLLECTION, userId);
    try {
      const userDoc = await getDoc(userRef);
      return userDoc.exists() ? (userDoc.data().progress as Progress) || {} : {};
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${USERS_COLLECTION}/${userId}`);
      return {};
    }
  },

  async saveProgress(userId: string, progress: Progress) {
    const userRef = doc(db, USERS_COLLECTION, userId);
    try {
      await setDoc(userRef, { 
        progress,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${USERS_COLLECTION}/${userId}`);
    }
  },

  async updateLastPlayed(userId: string, lastPlayed: { ministryId: string; category: string; lastPlayedAt: string; type: string }) {
    if (userId.startsWith('custom_')) {
      const username = userId.replace(/^custom_/, '');
      const userRef = doc(db, 'custom_users', username.toLowerCase());
      try {
        await setDoc(userRef, { 
          lastPlayed,
          isOnline: true,
          lastActiveAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        console.warn('Could not update lastPlayed for custom user:', error);
      }
      return;
    }

    const userRef = doc(db, USERS_COLLECTION, userId);
    try {
      await setDoc(userRef, { 
        lastPlayed,
        isOnline: true,
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn('Could not update lastPlayed:', error);
    }
  },

  async updateUserPresence(userId: string, isOnline: boolean, username?: string | null) {
    if (!userId) return;

    // If setting online, throttle writes to at most once per 30 seconds to prevent unnecessary network overhead
    const key = `${userId}_${username || ''}`;
    const now = Date.now();
    if (isOnline) {
      const lastWrite = lastPresenceWriteMap.get(key) || 0;
      if (now - lastWrite < PRESENCE_THROTTLE_MS) {
        return; // throttled: already marked recently
      }
    }
    lastPresenceWriteMap.set(key, now);

    try {
      if (userId.startsWith('custom_') || username) {
        const uName = (username || userId.replace(/^custom_/, '')).trim();
        if (uName && uName !== 'អ្នកគ្រប់គ្រង (Admin)') {
          const userRef = doc(db, 'custom_users', uName.toLowerCase());
          await setDoc(userRef, {
            isOnline,
            lastActiveAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } else {
        const userRef = doc(db, USERS_COLLECTION, userId);
        await setDoc(userRef, {
          isOnline,
          lastActiveAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.warn('Could not update user presence:', error);
    }
  },

  async testConnection() {
    try {
      // Use a known path or a dummy one just to probe connection
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration or network.");
      }
    }
  }
};

// Removed synchronous testConnection() to avoid SSR gRPC issues
