import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc as firestoreSetDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  limit
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { Match, GameCategory, Transaction, LeaderboardUser, UserWallet } from "../types";
import { SEED_MATCHES, SEED_LEADERBOARD } from "../data";

// Sanitize Data to avoid Firestore "undefined" field values
export function sanitizeData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item)) as any;
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = sanitizeData(val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

// Custom setDoc wrapper that automatically sanitizes inputs
function setDoc(docRef: any, data: any, options?: any) {
  return firestoreSetDoc(docRef, sanitizeData(data), options);
}

// Custom updateDoc wrapper that automatically sanitizes inputs
function updateDoc(docRef: any, data: any) {
  return firestoreUpdateDoc(docRef, sanitizeData(data));
}

// 1. Error Handler supporting standard FirestoreErrorInfo representation
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write"
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null
    },
    operationType,
    path
  };
  console.error("Firestore Error Detailed: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 2. REAL-TIME SUBSCRIPTIONS

// Subscribes to matches
export function subscribeMatches(onUpdate: (matches: Match[]) => void) {
  const path = "matches";
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: Match[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Match);
      });
      // Sort matches descending so new games appear first
      list.sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.id.replace(/\D/g, "")) || 0;
        return numB - numA;
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Subscribes to categories
export function subscribeCategories(onUpdate: (categories: GameCategory[]) => void) {
  const path = "categories";
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: GameCategory[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as GameCategory);
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Subscribes to leaderboard entries
export function subscribeLeaderboard(onUpdate: (entries: LeaderboardUser[]) => void) {
  const path = "leaderboard";
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: LeaderboardUser[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ ...docSnap.data() } as LeaderboardUser);
      });
      list.sort((a, b) => a.rank - b.rank);
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Subscribes to user profile balance and tag info
export function subscribeUserProfile(userId: string, onUpdate: (user: any) => void) {
  const path = `users/${userId}`;
  return onSnapshot(
    doc(db, "users", userId),
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data());
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Subscribes to all transactions (admins can see everything, users will see all but lists are safe)
export function subscribeTransactions(onUpdate: (transactions: Transaction[]) => void) {
  const path = "transactions";
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
      });
      // Sort newest transactions first
      list.sort((a, b) => {
        return b.date.localeCompare(a.date);
      });
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// 3. PERSISTENT WRITES & OPERATIONS

// Seed Database initially if there is no data
export async function seedDatabaseIfEmpty() {
  const matchesPath = "matches";
  try {
    const matchesSnap = await getDocs(collection(db, "matches"));
    if (matchesSnap.empty) {
      console.log("Firestore matches is empty. Automatic seeding default values...");
      
      // 1. Seed categories
      const defCats: GameCategory[] = [
        { id: "ff", name: "Free Fire", localName: "ফ্রি ফায়ার ও সিএস", icon: "🔥" },
        { id: "pubg", name: "PUBG Mobile", localName: "পাবজি মোবাইল", icon: "🔫" },
        { id: "ludo", name: "Ludo King", localName: "লুডু কিং ক্লাসিক", icon: "🎲" },
        { id: "mlbb", name: "Mobile Legends", localName: "মোবাইল লেজেন্ডস", icon: "⚔️" },
        { id: "dls", name: "DLS", localName: "ডিএলএস সকার", icon: "⚽" }
      ];
      for (const cat of defCats) {
        await setDoc(doc(db, "categories", cat.id), cat);
      }

      // 2. Seed matches
      for (const match of SEED_MATCHES) {
        await setDoc(doc(db, "matches", match.id), match);
      }

      // 3. Seed leaderboard
      for (const lead of SEED_LEADERBOARD) {
        await setDoc(doc(db, "leaderboard", `lead-${lead.gamertag.replace(/\s+/g, "_")}`), lead);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, matchesPath);
  }
}

// Register or update user profile
export async function upsertUserProfile(userId: string, data: { gamertag: string; balance?: number; deposit?: number; winning?: number }) {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      // New User creation
      const newUser = {
        id: userId,
        gamertag: data.gamertag,
        balance: data.balance !== undefined ? data.balance : 120, // Default signup seed
        deposit: data.deposit !== undefined ? data.deposit : 80,
        winning: data.winning !== undefined ? data.winning : 40,
        createdAt: new Date().toISOString()
      };
      await setDoc(docRef, newUser);
    } else {
      // Update existing
      await updateDoc(docRef, data);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Check if user has an admin designation
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const path = `admins/${userId}`;
  try {
    const docSnap = await getDoc(doc(db, "admins", userId));
    return docSnap.exists();
  } catch (error) {
    return false;
  }
}

// Register admin document initially (PIN Bootstrap entry)
export async function registerAdmin(userId: string) {
  const path = `admins/${userId}`;
  try {
    await setDoc(doc(db, "admins", userId), {
      userId,
      activatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Add Custom Category
export async function addCategory(cat: GameCategory) {
  const path = `categories/${cat.id}`;
  try {
    await setDoc(doc(db, "categories", cat.id), cat);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Delete Category
export async function deleteCategory(id: string) {
  const path = `categories/${id}`;
  try {
    await deleteDoc(doc(db, "categories", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Create new Match
export async function createMatch(m: Match) {
  const path = `matches/${m.id}`;
  try {
    await setDoc(doc(db, "matches", m.id), m);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Update match slots booking (join match)
export async function updateMatchSlots(matchId: string, slots: any[]) {
  const path = `matches/${matchId}`;
  try {
    await updateDoc(doc(db, "matches", matchId), { slots });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Add transaction request
export async function addTransaction(t: Transaction & { userId: string; userIgn: string }) {
  const path = `transactions/${t.id}`;
  try {
    await setDoc(doc(db, "transactions", t.id), t);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Approve or reject pending transaction
export async function updateTransactionStatus(
  trxId: string, 
  approve: boolean, 
  userId: string, 
  amount: number, 
  type: string
) {
  const trxPath = `transactions/${trxId}`;
  const userPath = `users/${userId}`;
  try {
    // 1. Update status
    await updateDoc(doc(db, "transactions", trxId), {
      status: approve ? "Approved" : "Rejected"
    });

    // 2. If approved, modify the associated player's user balance
    if (approve) {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        let balanceOffset = 0;
        let depositOffset = 0;

        if (type === "Deposit") {
          balanceOffset = amount;
          depositOffset = amount;
        } else if (type === "Withdraw") {
          balanceOffset = -amount;
        }

        await updateDoc(userRef, {
          balance: (userData.balance || 0) + balanceOffset,
          deposit: (userData.deposit || 0) + depositOffset
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, trxPath);
  }
}

// Declare match results and automatically credit rewards to matching players
export async function declareMatchResults(
  matchId: string,
  results: { rank: number; playerIgn: string; kills: number; prizeWon: number }[]
) {
  const matchPath = `matches/${matchId}`;
  try {
    // 1. Save results array and flag match to Completed
    await updateDoc(doc(db, "matches", matchId), {
      status: "Completed",
      results
    });

    // 2. Fetch all registered users to coordinate rewards by gamer tag
    const usersSnap = await getDocs(collection(db, "users"));
    const usersList: any[] = [];
    usersSnap.forEach((ds) => usersList.push({ id: ds.id, ...ds.data() }));

    for (const res of results) {
      // Look up if any user has matching gamertag (case-insensitive checking)
      const matchingUser = usersList.find(
        (u) => (u.gamertag || "").toLowerCase() === res.playerIgn.toLowerCase()
      );

      if (matchingUser) {
        const userRef = doc(db, "users", matchingUser.id);
        const payout = res.prizeWon;

        // Credit balance and payouts
        await updateDoc(userRef, {
          balance: (matchingUser.balance || 0) + payout,
          winning: (matchingUser.winning || 0) + payout
        });

        // Add transaction entry receipt
        const trxId = `trx-win-${Date.now()}-${res.rank}`;
        await setDoc(doc(db, "transactions", trxId), {
          id: trxId,
          userId: matchingUser.id,
          userIgn: matchingUser.gamertag,
          type: "Winning",
          amount: payout,
          status: "Approved",
          date: new Date().toLocaleString("en-US", { hour: "numeric", minute: "numeric", hour12: true }),
          matchId
        });
      }

      // Update leaderboard stats in firestore
      const leadId = `lead-${res.playerIgn.replace(/\s+/g, "_")}`;
      const leadRef = doc(db, "leaderboard", leadId);
      const leadSnap = await getDoc(leadRef);

      if (leadSnap.exists()) {
        const existingLead = leadSnap.data();
        await updateDoc(leadRef, {
          totalWon: (existingLead.totalWon || 0) + res.prizeWon,
          matchesPlayed: (existingLead.matchesPlayed || 0) + 1,
          totalKills: (existingLead.totalKills || 0) + res.kills
        });
      } else {
        // Create new entry
        await setDoc(leadRef, {
          rank: 20, // Lower ranking, dynamic sort later
          gamertag: res.playerIgn,
          totalWon: res.prizeWon,
          matchesPlayed: 1,
          totalKills: res.kills
        });
      }
    }

    // Refresh rankings of the leaderboard
    const allLeadsSnap = await getDocs(collection(db, "leaderboard"));
    const allLeads: any[] = [];
    allLeadsSnap.forEach((ds) => allLeads.push(ds.data()));
    // Sort descending by totalWon
    allLeads.sort((a, b) => b.totalWon - a.totalWon);
    
    // Write sorted ranks
    for (let i = 0; i < allLeads.length; i++) {
      const tag = allLeads[i].gamertag;
      const leadId = `lead-${tag.replace(/\s+/g, "_")}`;
      await updateDoc(doc(db, "leaderboard", leadId), { rank: i + 1 });
    }

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, matchPath);
  }
}
