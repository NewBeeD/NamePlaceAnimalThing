export type GamePhase = "lobby" | "play" | "ai-grading" | "scoring" | "round-breakdown" | "round-results" | "ended";

export type GameUser = {
  id: string;
  username: string;
  isHost: boolean;
};

export type GameSettings = {
  rounds: number;
  categories: string[];
  context?: string;
};

export type RoundBreakdown = {
  [playerId: string]: {
    [category: string]: {
      answer: string;
      points: number;
      reason: "unique" | "duplicate" | "invalid" | "empty" | "manual";
    };
  };
};

export type GameRoomState = {
  code: string;
  users: GameUser[];
  settings: GameSettings;
  currentRound: number;
  currentLetter: string;
  phase: GamePhase;
  currentAnswers: Record<string, Record<string, string>>;
  totalScores: Record<string, number>;
  roundBreakdown: RoundBreakdown;
  scoringAssignments?: Record<string, string[]>;
};
