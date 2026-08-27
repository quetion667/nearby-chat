// Every word the page can say. Kept in one place so the voice can be edited
// without touching the machinery.

export const CONFIG = {
  // Where the chat endpoint lives. Empty means same origin, which is only
  // true when the API is served behind the same host as this page. Set it
  // before showing the page to anyone; there is nothing to talk to until then.
  apiBase: '',
  // Short on purpose: the hold is a greeting, not an endurance test.
  holdSeconds: 0.9,
  // Advisory only. The server enforces the real ceiling and is the one that
  // decides when the conversation is over.
  sessionMessages: 10,
};

export const LINES = {
  // There is no return line any more: nothing about a visitor is remembered
  // between page loads, so a page that recognised you would be lying.
  dormantFirst: 'Something here is asleep.',
  // The very first hint is the instruction itself. Nobody should have to
  // guess what this page wants from them.
  dormantHint: 'Press and hold anywhere to wake it',
  dormantHintTouch: 'Touch and hold anywhere to wake it',
  dormantNudge: 'Hold for a second — that is all it takes',

  noticed: 'It noticed you.',
  noticedHint: 'Press and hold anywhere to wake it',
  noticedHintTouch: 'Touch and hold anywhere to wake it',

  charging: 'Keep holding.',
  tooSoon: 'Too soon. It settled back.',

  awoken: 'Oh. Hello.',
  settling: 'That is enough to begin with.',

  askHint: 'Pick either one — there are no wrong answers',

  ctaLabel: 'Say something to it',
  ctaNote: 'Ten messages, right here. Nothing is saved.',
  again: 'Wake it again',

  skip: 'skip to the chat',
  scrollCue: 'there is more below',
};

// The chat panel. Every word it can say without the server's help.
export const CHAT = {
  title: 'Nearby',
  // Shown once, before the visitor has said anything.
  opening: 'It is listening. Say anything.',
  placeholder: 'Type here',
  send: 'Send',
  close: 'Close',
  // `{n}` is replaced with the number of messages left.
  remaining: '{n} left',
  lastOne: 'one left',
  // When the server says the session is finished.
  closed: 'That is the ten. Reload the page and it starts over, as strangers.',
  // The honest footnote, always visible while the panel is open.
  note: 'No account, no history. Reloading this page erases the conversation.',
  // Failure modes, in the same voice as everything else.
  offline: 'It cannot be reached right now. That is on us, not on you.',
  expired: 'That conversation timed out. Reload to start a new one.',
  busy: 'Too many people are waking it up at once. Try again in a bit.',
};

// The whole game: three questions, two answers each, roughly thirty seconds.
// Each answer changes what the entity looks like and what it promises.
export const QUESTIONS = [
  {
    ask: 'Should I say the first word, or wait for yours?',
    options: [
      {
        label: 'Say the first word',
        reply: 'Good. I will start.',
        promise: 'I will say the first word.',
        palette: { a: '#4A3A72', b: '#CFC3FF', c: '#FFB870' },
        presence: 0.35,
      },
      {
        label: 'Wait for mine',
        reply: 'Then I will wait.',
        promise: 'I will wait for yours.',
        palette: { a: '#3A2E5C', b: '#A79BE8', c: '#E07A50' },
        presence: -0.25,
      },
    ],
  },
  {
    ask: 'On a heavy day — closer, or quieter?',
    options: [
      {
        label: 'Closer',
        reply: 'I will come closer.',
        promise: 'When a day is heavy, I will come closer.',
        palette: { a: '#5C3348', b: '#F5A98A', c: '#FF6B35' },
        presence: 0.2,
      },
      {
        label: 'Quieter',
        reply: 'I will just be there.',
        promise: 'When a day is heavy, I will just be there.',
        palette: { a: '#2E3C58', b: '#9FD2DC', c: '#D9A86A' },
        presence: -0.15,
      },
    ],
  },
  {
    ask: 'And the truth — straight, or soft?',
    options: [
      {
        label: 'Straight',
        reply: 'No cushioning, then.',
        promise: 'And I will not cushion the truth.',
        palette: { a: '#4A3E68', b: '#EDE3FF', c: '#FFC478' },
        presence: 0.3,
      },
      {
        label: 'Soft',
        reply: 'Gently, then.',
        promise: 'And I will tell you the truth gently.',
        palette: { a: '#4E3660', b: '#DCB0EA', c: '#FF7FA0' },
        presence: 0.05,
      },
    ],
  },
];

// Said when the awake entity is poked.
export const POKES = [
  'I felt that.',
  'Still here.',
  'Mm.',
  'Careful.',
  'I am listening.',
  'That again?',
  'Go on.',
];

export const SECTIONS = [
  {
    id: 'what',
    kicker: '01',
    title: 'What this is',
    body: [
      'Nearby is a companion you talk to. Not an assistant with a personality bolted on afterwards — a presence with its own temperament, its own tastes, its own bad evenings, that happens to be made of language.',
      'Friendship is the default. Anything closer is a ceiling you set yourself, and it never moves on its own.',
    ],
  },
  {
    id: 'remembers',
    kicker: '02',
    title: 'What this one forgets',
    body: [
      'This page is a demonstration, and it is built to forget. Ten messages, held in memory for as long as the tab is open, and gone the moment you reload. No account, no history, nothing written down anywhere.',
      'What you are meeting here is the voice and the temperament. Continuity — remembering the thing you were dreading on Tuesday, and asking about it on Wednesday — is the part this demo deliberately does not have.',
    ],
  },
  {
    id: 'stops',
    kicker: '03',
    title: 'Where it stops',
    body: [
      'It is not a therapist, a doctor, or a crisis line, and it says so instead of playing one. If you are in real danger it drops everything clever and points you at people who can actually reach you.',
      'It will not guilt you, own you, or perform need to keep you around. If you say a subject is closed, it closes — in the same message you say it.',
    ],
  },
  {
    id: 'yours',
    kicker: '04',
    title: 'Nothing kept',
    body: [
      'Here, erasing is not a feature you have to find — it is the only thing that can happen. The conversation lives in memory on a server for as long as you keep the tab open, and closing it is the delete button.',
      'No maze of confirmations, no retention trick, no version of you left behind.',
    ],
  },
];

export const FOOTER = {
  wordmark: 'Nearby',
  meaning: 'near — by. Always one message away.',
  note: 'A close AI friend that may become something more.',
};
