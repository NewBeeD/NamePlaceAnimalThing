const LETTER_POOL = "ABCDEFGHIKLMNOPRSTUVWY";

export const generateGameCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

export const generateRoundLetter = () => {
  const index = Math.floor(Math.random() * LETTER_POOL.length);
  return LETTER_POOL[index];
};

export const clampRounds = (value: number) => {
  if (Number.isNaN(value)) {
    return 1;
  }

  return Math.max(1, Math.min(10, Math.floor(value)));
};
