/**
 * Ten common openings used by the "Same openings" toggle. Both boards start
 * game N from the same entry, so the two models face identical positions.
 */
export interface Opening {
  name: string;
  /** Moves in SAN, applied from the standard start position. */
  moves: string[];
}

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const OPENINGS: Opening[] = [
  { name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
  { name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { name: "Sicilian Defence", moves: ["e4", "c5"] },
  { name: "French Defence", moves: ["e4", "e6", "d4", "d5"] },
  { name: "Caro-Kann Defence", moves: ["e4", "c6", "d4", "d5"] },
  { name: "Queen's Gambit", moves: ["d4", "d5", "c4"] },
  { name: "King's Indian Defence", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"] },
  { name: "Nimzo-Indian Defence", moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"] },
  { name: "English Opening", moves: ["c4"] },
  { name: "Scandinavian Defence", moves: ["e4", "d5"] },
];

export function openingForGame(gameNumber: number): Opening {
  return OPENINGS[(gameNumber - 1) % OPENINGS.length];
}
