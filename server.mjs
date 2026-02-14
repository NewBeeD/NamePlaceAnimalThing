import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const host = "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const OPENAI_MAX_CONCURRENT_REQUESTS = Math.max(1, Number(process.env.OPENAI_MAX_CONCURRENT_REQUESTS || 2));

let activeOpenAIRequests = 0;
const openAIQueue = [];

const processNextOpenAIJob = () => {
  if (activeOpenAIRequests >= OPENAI_MAX_CONCURRENT_REQUESTS) {
    return;
  }

  const nextJob = openAIQueue.shift();
  if (!nextJob) {
    return;
  }

  activeOpenAIRequests += 1;
  nextJob();
};

const enqueueOpenAIRequest = (task) => {
  return new Promise((resolve, reject) => {
    openAIQueue.push(async () => {
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        activeOpenAIRequests = Math.max(0, activeOpenAIRequests - 1);
        processNextOpenAIJob();
      }
    });

    processNextOpenAIJob();
  });
};

const LETTER_POOL = "ABCDEFGHIKLMNOPRSTUVWY";
const COMMON_NAMES = new Set([
  "aaron","abigail","adam","adrian","alex","alice","amanda","amelia","andrew","anna","anthony","aria","ashley",
  "ben","benjamin","blake","brandon","brian","brianna",
  "caleb","camila","carlos","caroline","charles","charlotte","chloe","christian","christopher","claire",
  "daniel","danielle","david","diana","dylan",
  "edward","elena","elizabeth","ella","emily","emma","ethan","eva","evan",
  "felix","fiona","frank",
  "gabriel","grace",
  "hannah","harper","hazel","henry","holly",
  "isabella","isla","ivan",
  "jack","jacob","james","jason","jasmine","jayden","jennifer","jeremy","jessica","john","jonathan","joseph","joshua","julia","julian",
  "karen","katherine","kayla","kevin","kimberly",
  "laura","layla","leo","liam","lily","logan","louis","lucas","lucy","luna",
  "madison","maria","mason","matthew","maya","megan","mia","michael","michelle","mila","muhammad",
  "natalie","nathan","noah","nora",
  "olivia","oscar","owen",
  "patrick","penelope","peter","phoebe",
  "quinn",
  "rachel","rebecca","richard","robert","ruby","ryan",
  "samantha","samuel","sarah","sebastian","sophia","sofia","stella","steven",
  "thomas","tristan","tyler",
  "victoria","violet",
  "william","wyatt",
  "xavier",
  "yara","yusuf",
  "zachary","zoe"
]);
const COMMON_ANIMALS = new Set([
  "ant","ape","bear","bee","buffalo","camel","cat","cheetah","chicken","chimpanzee","cow","crab","crocodile",
  "deer","dog","dolphin","donkey","duck","eagle","elephant","falcon","fox","frog","giraffe","goat","gorilla",
  "hamster","hawk","hippo","horse","hyena","jaguar","kangaroo","koala","leopard","lion","lizard","llama","monkey",
  "moose","mouse","octopus","owl","panda","panther","parrot","peacock","penguin","pig","pigeon","rabbit","raccoon",
  "rat","raven","rhino","seal","shark","sheep","snake","sparrow","squid","swan","tiger","turkey","turtle","whale",
  "wolf","zebra"
]);
const COMMON_COUNTRIES = new Set([
  "argentina","australia","austria","bangladesh","belgium","brazil","canada","chile","china","colombia","croatia",
  "denmark","egypt","england","ethiopia","finland","france","germany","ghana","greece","hungary","iceland","india",
  "indonesia","iran","iraq","ireland","israel","italy","jamaica","japan","kenya","malaysia","mexico","morocco",
  "nepal","netherlands","new zealand","nigeria","norway","pakistan","peru","philippines","poland","portugal","qatar",
  "romania","russia","saudi arabia","scotland","singapore","south africa","south korea","spain","sweden","switzerland",
  "thailand","turkey","uganda","ukraine","united arab emirates","united kingdom","united states","uruguay","venezuela",
  "vietnam","wales","zimbabwe"
]);
const COMMON_CITIES = new Set([
  "amsterdam","athens","atlanta","bangkok","barcelona","beijing","berlin","boston","brisbane","brussels","budapest",
  "cairo","calgary","cape town","chicago","copenhagen","dallas","delhi","dubai","dublin","edinburgh","florence",
  "geneva","glasgow","helsinki","houston","istanbul","jakarta","johannesburg","kathmandu","kyoto","lagos","lahore",
  "lima","lisbon","london","los angeles","madrid","manchester","melbourne","mexico city","miami","milan","montreal",
  "mumbai","munich","new york","osaka","oslo","ottawa","paris","prague","quebec","rome","san francisco","santiago",
  "seattle","seoul","shanghai","singapore","stockholm","sydney","taipei","tokyo","toronto","valencia","vancouver",
  "vienna","warsaw","washington","zurich"
]);
const COMMON_FOODS = new Set([
  "apple","apricot","avocado","banana","bagel","biscuit","bread","burger","burrito","cake","carrot","cereal","cheese",
  "chicken","chili","chips","chocolate","cookie","croissant","curry","donut","dumpling","egg","falafel","fries","grapes",
  "hamburger","honey","ice cream","jam","kebab","lasagna","lemon","mango","meatball","noodle","omelette","orange","pasta",
  "peach","pear","pepper","pizza","popcorn","pudding","pumpkin","ramen","rice","salad","sandwich","sausage","soup","steak",
  "sushi","taco","toast","tomato","waffle","yogurt"
]);
const COMMON_MOVIES = new Set([
  "avatar","aladdin","alien","amadeus","arrival","batman","braveheart","cars","casablanca","coco","dune","encanto",
  "frozen","gladiator","gravity","her","inception","interstellar","jaws","joker","memento","moana","notebook",
  "oppenheimer","parasite","psycho","rocky","scarface","shrek","tangled","titanic","up","whiplash","zootopia"
]);
const COMMON_BRANDS = new Set([
  "adidas","airbnb","amazon","apple","asus","audi","bmw","burberry","canon","coca cola","dell","disney","ferrari",
  "google","gucci","honda","hyundai","ikea","intel","kfc","lego","lenovo","loreal","louis vuitton","mcdonalds","mercedes",
  "microsoft","netflix","nike","nintendo","nokia","pepsi","porsche","prada","reebok","samsung","sony","starbucks","tesla",
  "toyota","uber","uniqlo","visa","volkswagen","xbox","yamaha","zara"
]);

const generateRoundLetter = () => {
  const index = Math.floor(Math.random() * LETTER_POOL.length);
  return LETTER_POOL[index];
};

const normalizeSettings = (settings) => {
  const categories = Array.isArray(settings?.categories)
    ? settings.categories.filter(Boolean).slice(0, 4)
    : ["Name", "Place", "Animal", "Thing"];
  const context = String(settings?.context || "").trim().slice(0, 80);

  return {
    rounds: Math.max(1, Math.min(10, Number(settings?.rounds || 1))),
    categories: categories.length > 0 ? categories : ["Name", "Place", "Animal", "Thing"],
    context,
  };
};

const shuffleArray = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildRandomDerangement = (ids) => {
  if (ids.length <= 1) {
    return [];
  }

  if (ids.length === 2) {
    return [ids[1], ids[0]];
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = shuffleArray(ids);
    if (candidate.every((id, index) => id !== ids[index])) {
      return candidate;
    }
  }

  return [...ids.slice(1), ids[0]];
};

const generateManualScoringAssignments = (users) => {
  const ids = users.map((user) => user.id);
  const assignments = {};

  if (ids.length <= 1) {
    for (const id of ids) {
      assignments[id] = [];
    }
    return assignments;
  }

  const shuffledScorers = shuffleArray(ids);
  const derangedTargets = buildRandomDerangement(shuffledScorers);

  for (let index = 0; index < shuffledScorers.length; index += 1) {
    const scorerId = shuffledScorers[index];
    const targetId = derangedTargets[index];
    assignments[scorerId] = [targetId];
  }

  if (ids.length % 2 === 1) {
    const hostId = users.find((user) => user.isHost)?.id || ids[0];
    const existingTargets = assignments[hostId] || [];
    const extraOptions = ids.filter((id) => id !== hostId && !existingTargets.includes(id));
    if (extraOptions.length > 0) {
      const extraTarget = extraOptions[Math.floor(Math.random() * extraOptions.length)];
      assignments[hostId] = [...existingTargets, extraTarget];
    }
  }

  return assignments;
};

const normalizeManualScore = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  if (numeric >= 10) {
    return 10;
  }
  return numeric >= 5 ? 5 : 0;
};

const isLikelyValidWord = (value, requiredLetter) => {
  if (!value) {
    return false;
  }

  const cleaned = String(value).trim();
  if (!cleaned) {
    return false;
  }

  if (cleaned[0].toUpperCase() !== requiredLetter.toUpperCase()) {
    return false;
  }

  return /^[A-Za-z\s'\-]+$/.test(cleaned);
};

const levenshteinDistance = (first, second) => {
  if (first === second) {
    return 0;
  }

  const firstLength = first.length;
  const secondLength = second.length;

  if (firstLength === 0) {
    return secondLength;
  }

  if (secondLength === 0) {
    return firstLength;
  }

  const matrix = Array.from({ length: firstLength + 1 }, () => Array(secondLength + 1).fill(0));

  for (let row = 0; row <= firstLength; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column <= secondLength; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= firstLength; row += 1) {
    for (let column = 1; column <= secondLength; column += 1) {
      const substitutionCost = first[row - 1] === second[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  return matrix[firstLength][secondLength];
};

const isLikelyValidName = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (COMMON_NAMES.has(normalized)) {
    return true;
  }

  if (normalized.length <= 2) {
    return false;
  }

  for (const dictionaryName of COMMON_NAMES) {
    if (Math.abs(dictionaryName.length - normalized.length) > 1) {
      continue;
    }

    if (levenshteinDistance(dictionaryName, normalized) <= 1) {
      return true;
    }
  }

  return false;
};

const normalizeEntry = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const isInSet = (set, value) => {
  const normalized = normalizeEntry(value);
  return set.has(normalized);
};

const isCategoryMatch = (category, answer) => {
  const normalizedCategory = normalizeEntry(category);
  const normalizedAnswer = normalizeEntry(answer);

  if (!normalizedAnswer) {
    return false;
  }

  if (normalizedCategory === "name") {
    return isLikelyValidName(normalizedAnswer);
  }

  if (normalizedCategory === "animal") {
    return isInSet(COMMON_ANIMALS, normalizedAnswer);
  }

  if (normalizedCategory === "country") {
    return isInSet(COMMON_COUNTRIES, normalizedAnswer);
  }

  if (normalizedCategory === "city") {
    return isInSet(COMMON_CITIES, normalizedAnswer);
  }

  if (normalizedCategory === "place") {
    return isInSet(COMMON_CITIES, normalizedAnswer) || isInSet(COMMON_COUNTRIES, normalizedAnswer);
  }

  if (normalizedCategory === "food") {
    return isInSet(COMMON_FOODS, normalizedAnswer);
  }

  if (normalizedCategory === "movie") {
    return isInSet(COMMON_MOVIES, normalizedAnswer);
  }

  if (normalizedCategory === "brand") {
    return isInSet(COMMON_BRANDS, normalizedAnswer);
  }

  if (normalizedCategory === "thing") {
    return !isInSet(COMMON_NAMES, normalizedAnswer)
      && !isInSet(COMMON_ANIMALS, normalizedAnswer)
      && !isInSet(COMMON_CITIES, normalizedAnswer)
      && !isInSet(COMMON_COUNTRIES, normalizedAnswer);
  }

  return true;
};

const parseJsonObject = (value) => {
  if (!value) {
    return null;
  }

  const direct = String(value).trim();
  if (!direct) {
    return null;
  }

  try {
    return JSON.parse(direct);
  } catch {
    const start = direct.indexOf("{");
    const end = direct.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(direct.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

const extractResponseText = (responsePayload) => {
  if (typeof responsePayload?.output_text === "string" && responsePayload.output_text.trim()) {
    return responsePayload.output_text;
  }

  const chunks = [];
  for (const item of responsePayload?.output || []) {
    if (item?.type !== "message") {
      continue;
    }

    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
};

const validateEntriesWithLLM = async ({ letter, entries, context }) => {
  if (!OPENAI_API_KEY) {
    return {
      aiAvailable: false,
      validationMap: null,
    };
  }

  if (entries.length === 0) {
    return {
      aiAvailable: true,
      validationMap: new Map(),
    };
  }

  const instruction = [
    "You validate Name Place Animal Thing answers.",
    "Rules:",
    "1) A valid answer must start with the given round letter.",
    "2) It must semantically match its category.",
    "3) For category Name, also validate spelling and likely-person-name quality.",
    context
      ? `4) Context lock is active: all answers should be appropriate to this context: ${context}. If an answer is contextually plausible, prefer VALID over INVALID.`
      : "4) If an answer is category-correct and plausibly real, prefer VALID over INVALID.",
    "5) Be tolerant of capitalization, minor spelling variants, and common transliterations.",
    "6) Do NOT mark INVALID only because a word is uncommon or unfamiliar.",
    "7) Prefer VALID when uncertain; reserve INVALID for clear rule violations (wrong starting letter, clear misspelling, or clear category/context mismatch).",
    "Return strict JSON only in this format:",
    '{"results":[{"id":"<id>","valid":true,"confidence":0.0,"reason":"short reason"}]}',
  ].join("\n");

  const payload = {
    model: OPENAI_MODEL,
    temperature: 0,
    input: [
      {
        role: "system",
        content: instruction,
      },
      {
        role: "user",
        content: JSON.stringify({
          letter,
          context,
          entries,
        }),
      },
    ],
  };

  try {
    const response = await enqueueOpenAIRequest(() =>
      fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
      }),
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${message}`);
    }

    const body = await response.json();
    const outputText = extractResponseText(body);
    const parsed = parseJsonObject(outputText);

    if (!parsed || !Array.isArray(parsed.results)) {
      throw new Error("Invalid JSON structure from OpenAI validation response.");
    }

    const validationMap = new Map();
    for (const result of parsed.results) {
      if (!result || typeof result.id !== "string") {
        continue;
      }

      validationMap.set(result.id, {
        valid: Boolean(result.valid),
        confidence:
          typeof result.confidence === "number" && Number.isFinite(result.confidence)
            ? Math.max(0, Math.min(1, result.confidence))
            : 0.5,
        reason: typeof result.reason === "string" ? result.reason : "",
      });
    }

    return {
      aiAvailable: true,
      validationMap,
    };
  } catch (error) {
    console.warn("AI validation unavailable, switching to manual peer scoring fallback.", error);
    return {
      aiAvailable: false,
      validationMap: null,
    };
  }
};

const evaluateRoundWithAI = async (room) => {
  const entryLookup = {};
  const llmEntries = [];

  for (const user of room.users) {
    for (const category of room.settings.categories) {
      const answer = String(room.currentAnswers[user.id]?.[category] || "").trim();
      if (!answer) {
        continue;
      }

      if (!isLikelyValidWord(answer, room.currentLetter)) {
        continue;
      }

      const id = `${user.id}::${category}`;
      entryLookup[id] = { userId: user.id, category, answer };
      llmEntries.push({
        id,
        category,
        answer,
      });
    }
  }

  const { aiAvailable, validationMap: llmValidationMap } = await validateEntriesWithLLM({
    letter: room.currentLetter,
    context: room.settings.context,
    entries: llmEntries,
  });

  if (!aiAvailable) {
    return {
      aiAvailable: false,
      breakdown: {},
      roundTotals: {},
    };
  }

  const frequencies = {};
  for (const category of room.settings.categories) {
    frequencies[category] = {};
  }

  for (const user of room.users) {
    for (const category of room.settings.categories) {
      const answer = String(room.currentAnswers[user.id]?.[category] || "").trim();
      const entryId = `${user.id}::${category}`;
      const basicWordCheck = isLikelyValidWord(answer, room.currentLetter);
      const llmResult = llmValidationMap?.get(entryId);
      const llmAccepts = llmResult ? (llmResult.valid || llmResult.confidence < 0.8) : true;
      const validForCategory = basicWordCheck && llmAccepts;
      if (!validForCategory) {
        continue;
      }

      const key = answer.toLowerCase();
      frequencies[category][key] = (frequencies[category][key] || 0) + 1;
    }
  }

  const breakdown = {};
  const roundTotals = {};

  for (const user of room.users) {
    breakdown[user.id] = {};
    let total = 0;

    for (const category of room.settings.categories) {
      const answer = String(room.currentAnswers[user.id]?.[category] || "").trim();
      const entryId = `${user.id}::${category}`;
      let points = 0;
      let reason = "empty";

      if (answer) {
        const basicWordCheck = isLikelyValidWord(answer, room.currentLetter);
        const llmResult = llmValidationMap?.get(entryId);
        const llmAccepts = llmResult ? (llmResult.valid || llmResult.confidence < 0.8) : true;
        const validForCategory = basicWordCheck && llmAccepts;
        if (!validForCategory) {
          points = 0;
          reason = "invalid";
        } else {
          const key = answer.toLowerCase();
          const count = frequencies[category][key] || 0;
          if (count > 1) {
            points = 5;
            reason = "duplicate";
          } else {
            points = 10;
            reason = "unique";
          }
        }
      }

      breakdown[user.id][category] = {
        answer,
        points,
        reason,
      };
      total += points;
    }

    roundTotals[user.id] = Math.min(40, total);
  }

  return {
    aiAvailable: true,
    breakdown,
    roundTotals,
  };
};

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const rooms = new Map();
  const presence = new Map();

  const closeRoomForAll = (roomCode, reason = "Host left. Room closed.") => {
    io.to(roomCode).emit("room-closed", { reason });
    io.in(roomCode).socketsLeave(roomCode);

    for (const [socketId, track] of presence.entries()) {
      if (track?.code === roomCode) {
        presence.delete(socketId);
      }
    }

    rooms.delete(roomCode);
  };

  const emitRoomState = (room) => {
    io.to(room.code).emit("room-state", {
      code: room.code,
      users: room.users,
      settings: room.settings,
      currentRound: room.currentRound,
      currentLetter: room.currentLetter,
      phase: room.phase,
      currentAnswers: room.currentAnswers,
      totalScores: room.totalScores,
      roundBreakdown: room.roundBreakdown,
      scoringAssignments: room.scoringAssignments,
    });
  };

  const getRoomBySocket = (socket) => {
    const track = presence.get(socket.id);
    if (!track) {
      return null;
    }

    return rooms.get(track.code) || null;
  };

  io.on("connection", (socket) => {
    socket.on("join-room", (payload, callback) => {
      const code = String(payload?.code || "").trim();
      const userId = String(payload?.userId || "").trim();
      const username = String(payload?.username || "").trim();

      if (!code || !userId || !username) {
        callback?.({ ok: false, message: "Invalid room payload." });
        return;
      }

      let room = rooms.get(code);

      if (!room) {
        if (!payload?.settings) {
          callback?.({ ok: false, message: "Room not found." });
          return;
        }

        room = {
          code,
          users: [{ id: userId, username, isHost: true }],
          settings: normalizeSettings(payload.settings),
          currentRound: 0,
          currentLetter: "",
          phase: "lobby",
          currentAnswers: {},
          totalScores: { [userId]: 0 },
          roundBreakdown: {},
          submittedUserIds: [],
          scoreSheets: {},
          scoringAssignments: {},
        };

        rooms.set(code, room);
      } else {
        const existing = room.users.find((user) => user.id === userId);

        if (!existing && room.phase !== "lobby") {
          callback?.({ ok: false, message: "Game already started. You cannot join now." });
          return;
        }

        if (existing) {
          existing.username = username;
        } else {
          room.users.push({ id: userId, username, isHost: false });
          room.totalScores[userId] = room.totalScores[userId] || 0;
        }
      }

      presence.set(socket.id, { code, userId });
      socket.join(code);

      io.to(code).emit("user-joined", room.users);
      emitRoomState(room);
      callback?.({ ok: true });
    });

    socket.on("start-game", (payload) => {
      const room = getRoomBySocket(socket);
      if (!room) {
        return;
      }

      const code = String(payload?.code || "").trim();
      if (code !== room.code || room.phase !== "lobby") {
        return;
      }

      const requesterId = presence.get(socket.id)?.userId;
      const requester = room.users.find((user) => user.id === requesterId);

      if (!requester?.isHost) {
        return;
      }

      room.currentRound = 1;
      room.currentLetter = generateRoundLetter();
      room.phase = "play";
      room.currentAnswers = {};
      room.roundBreakdown = {};
      room.submittedUserIds = [];
      room.scoreSheets = {};
      room.scoringAssignments = {};

      io.to(room.code).emit("round-start", {
        round: room.currentRound,
        letter: room.currentLetter,
      });
      emitRoomState(room);
    });

    socket.on("draft-response", (payload) => {
      const room = getRoomBySocket(socket);
      if (!room || room.phase !== "play" || payload?.code !== room.code) {
        return;
      }

      const userId = String(payload?.userId || "").trim();
      if (!userId) {
        return;
      }

      const partial = payload?.answers || {};
      const previous = room.currentAnswers[userId] || {};
      const merged = { ...previous };

      for (const category of room.settings.categories) {
        const value = String(partial[category] || "").trim();
        if (value) {
          merged[category] = value;
        }
      }

      room.currentAnswers[userId] = merged;
    });

    socket.on("submit-response", (payload) => {
      const room = getRoomBySocket(socket);
      if (!room || room.phase !== "play" || payload?.code !== room.code) {
        return;
      }

      const userId = String(payload?.userId || "").trim();
      if (!userId) {
        return;
      }

      if (room.submittedUserIds.includes(userId)) {
        return;
      }

      const submitted = payload.answers || {};
      const finalAnswers = {};
      for (const category of room.settings.categories) {
        finalAnswers[category] = String(submitted[category] || room.currentAnswers[userId]?.[category] || "").trim();
      }

      const hasAllFields = room.settings.categories.every((category) => Boolean(finalAnswers[category]));
      if (!hasAllFields) {
        socket.emit("submit-error", { message: "Fill all fields before submitting." });
        return;
      }

      room.currentAnswers[userId] = finalAnswers;
      room.submittedUserIds.push(userId);

      for (const participant of room.users) {
        if (participant.id === userId) {
          continue;
        }

        const previous = room.currentAnswers[participant.id] || {};
        const snapshot = {};
        for (const category of room.settings.categories) {
          snapshot[category] = String(previous[category] || "").trim();
        }
        room.currentAnswers[participant.id] = snapshot;
      }

      room.phase = "ai-grading";
      emitRoomState(room);

      setTimeout(() => {
        if (room.phase !== "ai-grading") {
          return;
        }

        Promise.resolve(evaluateRoundWithAI(room))
          .then(({ aiAvailable, breakdown, roundTotals }) => {
            if (room.phase !== "ai-grading") {
              return;
            }

            if (!aiAvailable) {
              room.phase = "scoring";
              room.scoreSheets = {};
              room.scoringAssignments = generateManualScoringAssignments(room.users);
              io.to(room.code).emit("manual-scoring-required", {
                round: room.currentRound,
              });
              emitRoomState(room);
              return;
            }

            room.roundBreakdown = breakdown;

            for (const participant of room.users) {
              room.totalScores[participant.id] = (room.totalScores[participant.id] || 0) + (roundTotals[participant.id] || 0);
            }

            room.phase = "round-breakdown";
            io.to(room.code).emit("ai-grading-complete", {
              round: room.currentRound,
              roundBreakdown: room.roundBreakdown,
            });
            emitRoomState(room);
          })
          .catch((error) => {
            console.error("AI grading failed.", error);
            room.phase = "scoring";
            room.scoreSheets = {};
            room.scoringAssignments = generateManualScoringAssignments(room.users);
            emitRoomState(room);
          });
      }, 1800);
    });

    socket.on("submit-scores", (payload, callback) => {
      const room = getRoomBySocket(socket);
      if (!room || room.phase !== "scoring" || payload?.code !== room.code) {
        callback?.({ ok: false, message: "Round is not in manual scoring phase." });
        return;
      }

      const scorerId = String(payload?.userId || "").trim();
      if (!scorerId) {
        callback?.({ ok: false, message: "Invalid scorer." });
        return;
      }

      const assignedTargets = room.scoringAssignments?.[scorerId] || [];
      const submittedScores = payload?.scores || {};
      const sanitizedScores = {};

      for (const targetId of assignedTargets) {
        sanitizedScores[targetId] = {};
        for (const category of room.settings.categories) {
          sanitizedScores[targetId][category] = normalizeManualScore(submittedScores?.[targetId]?.[category]);
        }
      }

      room.scoreSheets[scorerId] = sanitizedScores;

      const requiredScorers = room.users
        .map((user) => user.id)
        .filter((userId) => (room.scoringAssignments?.[userId] || []).length > 0);

      const scoredUsers = requiredScorers.filter((userId) => Boolean(room.scoreSheets[userId]));

      if (scoredUsers.length < requiredScorers.length) {
        io.to(room.code).emit("scores-submitted", {
          submitted: scoredUsers.length,
          expected: requiredScorers.length,
        });
        callback?.({ ok: true });
        return;
      }

      const manualBreakdown = {};
      const roundTotals = {};

      for (const target of room.users) {
        manualBreakdown[target.id] = {};
        let total = 0;

        for (const category of room.settings.categories) {
          const values = requiredScorers
            .filter((graderId) => (room.scoringAssignments?.[graderId] || []).includes(target.id))
            .map((graderId) => Number(room.scoreSheets[graderId]?.[target.id]?.[category] ?? 0))
            .filter((value) => Number.isFinite(value));

          const average = values.length > 0
            ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
            : 0;

          const normalized = normalizeManualScore(average);

          manualBreakdown[target.id][category] = {
            answer: String(room.currentAnswers[target.id]?.[category] || "").trim(),
            points: normalized,
            reason: "manual",
          };
          total += normalized;
        }

        roundTotals[target.id] = Math.min(40, total);
      }

      room.roundBreakdown = manualBreakdown;
      for (const user of room.users) {
        room.totalScores[user.id] = (room.totalScores[user.id] || 0) + (roundTotals[user.id] || 0);
      }

      room.phase = "round-breakdown";
      emitRoomState(room);
      callback?.({ ok: true });
    });

    socket.on("next-stage", (payload, callback) => {
      const room = getRoomBySocket(socket);
      if (!room || payload?.code !== room.code) {
        callback?.({ ok: false, message: "Room unavailable." });
        return;
      }

      const requesterId = presence.get(socket.id)?.userId;
      const requester = room.users.find((user) => user.id === requesterId);
      if (!requester?.isHost) {
        callback?.({ ok: false, message: "Only host can continue." });
        return;
      }

      if (room.phase === "round-breakdown") {
        room.phase = "round-results";
        emitRoomState(room);
        callback?.({ ok: true });
        return;
      }

      if (room.phase === "round-results") {
        if (room.currentRound >= room.settings.rounds) {
          room.phase = "ended";
          io.to(room.code).emit("game-end", {
            totalScores: room.totalScores,
          });
          emitRoomState(room);
          callback?.({ ok: true });
          return;
        }

        room.currentRound += 1;
        room.phase = "play";
        room.currentLetter = generateRoundLetter();
        room.currentAnswers = {};
        room.roundBreakdown = {};
        room.submittedUserIds = [];
        room.scoreSheets = {};
        room.scoringAssignments = {};

        io.to(room.code).emit("round-start", {
          round: room.currentRound,
          letter: room.currentLetter,
        });
        emitRoomState(room);
        callback?.({ ok: true });
        return;
      }

      callback?.({ ok: false, message: "Cannot continue from current phase." });
    });

    socket.on("leave-room", (payload, callback) => {
      const track = presence.get(socket.id);
      const code = String(payload?.code || "").trim();
      const userId = String(payload?.userId || "").trim();

      if (!track || !code || !userId || track.code !== code || track.userId !== userId) {
        callback?.({ ok: false, message: "Leave request is invalid." });
        return;
      }

      const room = rooms.get(code);
      presence.delete(socket.id);
      socket.leave(code);

      if (!room) {
        callback?.({ ok: true });
        return;
      }

      const leavingUser = room.users.find((user) => user.id === userId);
      if (leavingUser?.isHost) {
        closeRoomForAll(code, "Host exited. Room closed.");
        callback?.({ ok: true });
        return;
      }

      room.users = room.users.filter((user) => user.id !== userId);
      delete room.totalScores[userId];
      delete room.currentAnswers[userId];
      delete room.roundBreakdown[userId];
      room.submittedUserIds = room.submittedUserIds.filter((id) => id !== userId);
      delete room.scoreSheets[userId];

      if (room.users.length === 0) {
        rooms.delete(code);
        callback?.({ ok: true });
        return;
      }

      if (!room.users.some((user) => user.isHost)) {
        room.users[0].isHost = true;
      }

      if (room.phase === "scoring") {
        room.scoringAssignments = generateManualScoringAssignments(room.users);
        room.scoreSheets = {};
      }

      io.to(code).emit("user-left", room.users);
      emitRoomState(room);
      callback?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const track = presence.get(socket.id);
      presence.delete(socket.id);

      if (!track) {
        return;
      }

      const room = rooms.get(track.code);
      if (!room) {
        return;
      }

      const leavingUser = room.users.find((user) => user.id === track.userId);
      if (leavingUser?.isHost) {
        closeRoomForAll(track.code, "Host disconnected. Room closed.");
        return;
      }

      room.users = room.users.filter((user) => user.id !== track.userId);

      if (room.users.length === 0) {
        rooms.delete(track.code);
        return;
      }

      if (!room.users.some((user) => user.isHost)) {
        room.users[0].isHost = true;
      }

      if (room.phase === "scoring") {
        room.scoringAssignments = generateManualScoringAssignments(room.users);
        room.scoreSheets = {};
      }

      io.to(room.code).emit("user-left", room.users);
      emitRoomState(room);
    });
  });

  httpServer.listen(port, host, () => {
    console.log(`> Ready on http://${host}:${port}`);
  });
});
