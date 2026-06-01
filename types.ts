export type GameName = string;
export type MatchStatus = "Upcoming" | "Ongoing" | "Completed";
export type TeamType = "Solo" | "Duo" | "Squad";

export interface GameCategory {
  id: string;
  name: string;
  localName: string;
  icon: string;
}

export interface MatchSlot {
  slotNo: number;
  gameId: string;
  gameName: string;
  isBooked: boolean;
  registeredBy?: string; // Users email or nickname
}

export interface Match {
  id: string;
  game: GameName;
  matchNum: number;
  dateTime: string;
  title: string;
  prizePool: number;
  entryFee: number;
  perKill: number;
  version: string;
  map: string;
  type: TeamType;
  totalSlots: number;
  slots: MatchSlot[];
  status: MatchStatus;
  roomId?: string;
  roomPass?: string;
  results?: {
    rank: number;
    playerIgn: string;
    kills: number;
    prizeWon: number;
  }[];
}

export interface Transaction {
  id: string;
  type: "Deposit" | "Withdraw" | "Entry Fee" | "Winning";
  amount: number;
  method?: "bKash" | "Nagad" | "Rocket";
  number?: string;
  trxId?: string;
  status: "Pending" | "Approved" | "Rejected";
  date: string;
  matchId?: string;
}

export interface UserWallet {
  balance: number;
  deposit: number;
  winning: number;
  transactions: Transaction[];
}

export interface LeaderboardUser {
  rank: number;
  gamertag: string;
  totalWon: number;
  matchesPlayed: number;
  totalKills: number;
}
