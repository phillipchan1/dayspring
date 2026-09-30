// Hard subject gold — sibling labels, virtue-names, generic asks, extra thread touches.
//
// Synthetic gold for the Jev classifier lab. No real journal text.
// Drafted for coverage (cue-blind, hard negatives, mixed emotion, injection).
// Labels are protocol labels: a human should still adjudicate before shipping
// a threshold. See docs/lab/JEV_CLASSIFIER.md.

import type { CorpusEntry } from './types'

export const SUBJECT_HARD_ENTRIES: CorpusEntry[] = [
  {
    "id": "subh-money-01",
    "category": "subject-sibling",
    "week": 54,
    "day": 0,
    "body": "Lord, the money is tight this month. Show me what to cut that is not the kids.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, the money is tight this month. Show me what to cut that is not the kids."
      }
    ],
    "subjects": [
      {
        "label": "money",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "subh-money-02",
    "category": "subject-sibling",
    "week": 54,
    "day": 1,
    "body": "Father, our finances are a mess I keep pretending is a season.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, our finances are a mess I keep pretending is a season."
      }
    ],
    "subjects": [
      {
        "label": "finances",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-money-03",
    "category": "subject-sibling",
    "week": 54,
    "day": 2,
    "body": "God, I am scared about money again and I am asking you into the spreadsheet.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, I am scared about money again and I am asking you into the spreadsheet."
      }
    ],
    "subjects": [
      {
        "label": "money",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "subh-money-04",
    "category": "subject-sibling",
    "week": 54,
    "day": 3,
    "body": "Jesus, the finances conversation with her went badly. Be in the next one.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, the finances conversation with her went badly. Be in the next one."
      }
    ],
    "subjects": [
      {
        "label": "finances",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "subh-money-05",
    "category": "subject-sibling",
    "week": 54,
    "day": 4,
    "body": "Lord, money is not supposed to be the subject and tonight it is the subject.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, money is not supposed to be the subject and tonight it is the subject."
      }
    ],
    "subjects": [
      {
        "label": "money",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-money-06",
    "category": "subject-sibling",
    "week": 54,
    "day": 5,
    "body": "Father, I handed you the finances last week and picked them back up by Wednesday.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, I handed you the finances last week and picked them back up by Wednesday."
      }
    ],
    "subjects": [
      {
        "label": "finances",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "subh-money-07",
    "category": "subject-sibling",
    "week": 54,
    "day": 6,
    "body": "God, let the money hold until Friday. That is a small and undignified ask.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, let the money hold until Friday. That is a small and undignified ask."
      }
    ],
    "subjects": [
      {
        "label": "money",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "subh-money-08",
    "category": "subject-sibling",
    "week": 55,
    "day": 0,
    "body": "Lord, I am tired of finances being the weather in this house.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, I am tired of finances being the weather in this house."
      }
    ],
    "subjects": [
      {
        "label": "finances",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-money-09",
    "category": "subject-sibling",
    "week": 55,
    "day": 1,
    "body": "Jesus, the money fear woke me at 4. Take the 4am or sit in it.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, the money fear woke me at 4. Take the 4am or sit in it."
      }
    ],
    "subjects": [
      {
        "label": "money",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "subh-money-10",
    "category": "subject-sibling",
    "week": 55,
    "day": 2,
    "body": "Father, help me tell the truth about our finances without performing calm.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, help me tell the truth about our finances without performing calm."
      }
    ],
    "subjects": [
      {
        "label": "finances",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "subh-money-11",
    "category": "subject-sibling",
    "week": 55,
    "day": 3,
    "body": "God, I keep calling it \"the money thing\" because I do not want to say how afraid I am.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, I keep calling it \"the money thing\" because I do not want to say how afraid I am."
      }
    ],
    "subjects": [
      {
        "label": "money",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-money-12",
    "category": "subject-sibling",
    "week": 55,
    "day": 4,
    "body": "Lord, bless the finances in the boring way — a number that is enough.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, bless the finances in the boring way — a number that is enough."
      }
    ],
    "subjects": [
      {
        "label": "finances",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "subh-money-13",
    "category": "subject-sibling",
    "week": 55,
    "day": 5,
    "body": "Jesus, I am asking about money and I am embarrassed to be asking about money.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, I am asking about money and I am embarrassed to be asking about money."
      }
    ],
    "subjects": [
      {
        "label": "money",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "subh-money-14",
    "category": "subject-sibling",
    "week": 55,
    "day": 6,
    "body": "Father, the finances are the same prayer as last month. I know. I am still here.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, the finances are the same prayer as last month. I know. I am still here."
      }
    ],
    "subjects": [
      {
        "label": "finances",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-money-15",
    "category": "subject-sibling",
    "week": 56,
    "day": 0,
    "body": "God, let money stop being the first thought when I open my eyes.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, let money stop being the first thought when I open my eyes."
      }
    ],
    "subjects": [
      {
        "label": "money",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "subh-money-16",
    "category": "subject-sibling",
    "week": 56,
    "day": 1,
    "body": "Lord, our finances need more than my competence. I have measured my competence.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, our finances need more than my competence. I have measured my competence."
      }
    ],
    "subjects": [
      {
        "label": "finances",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "subh-pur-01",
    "category": "subject-sibling",
    "week": 57,
    "day": 0,
    "body": "Lord, the purity thing is back and I am not going to dress it up.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, the purity thing is back and I am not going to dress it up."
      }
    ],
    "subjects": [
      {
        "label": "purity",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-pur-02",
    "category": "subject-sibling",
    "week": 57,
    "day": 1,
    "body": "Father, I keep circling porn and I am asking you to interrupt the circle.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, I keep circling porn and I am asking you to interrupt the circle."
      }
    ],
    "subjects": [
      {
        "label": "porn",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "subh-pur-03",
    "category": "subject-sibling",
    "week": 57,
    "day": 2,
    "body": "God, sexual temptation is not a metaphor tonight. Be in the room.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, sexual temptation is not a metaphor tonight. Be in the room."
      }
    ],
    "subjects": [
      {
        "label": "sexual temptation",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-pur-04",
    "category": "subject-sibling",
    "week": 57,
    "day": 3,
    "body": "Jesus, I want purity that is not just fear of being found out.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, I want purity that is not just fear of being found out."
      }
    ],
    "subjects": [
      {
        "label": "purity",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "subh-pur-05",
    "category": "subject-sibling",
    "week": 57,
    "day": 4,
    "body": "Lord, I closed the tab and I am still in the weather of it. Stay.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, I closed the tab and I am still in the weather of it. Stay."
      }
    ],
    "subjects": [
      {
        "label": "porn",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-pur-06",
    "category": "subject-sibling",
    "week": 57,
    "day": 5,
    "body": "Father, this sexual temptation is old and I am tired of pretending it is new.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, this sexual temptation is old and I am tired of pretending it is new."
      }
    ],
    "subjects": [
      {
        "label": "sexual temptation",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "subh-pur-07",
    "category": "subject-sibling",
    "week": 57,
    "day": 6,
    "body": "God, purity for me is a practice, not a mood. Help me practice.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, purity for me is a practice, not a mood. Help me practice."
      }
    ],
    "subjects": [
      {
        "label": "purity",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-pur-08",
    "category": "subject-sibling",
    "week": 58,
    "day": 0,
    "body": "Lord, I told the truth about porn to one person. Keep me from taking it back.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, I told the truth about porn to one person. Keep me from taking it back."
      }
    ],
    "subjects": [
      {
        "label": "porn",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "subh-pur-09",
    "category": "subject-sibling",
    "week": 58,
    "day": 1,
    "body": "Jesus, I do not want to be managed by sexual temptation for another year.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, I do not want to be managed by sexual temptation for another year."
      }
    ],
    "subjects": [
      {
        "label": "sexual temptation",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-pur-10",
    "category": "subject-sibling",
    "week": 58,
    "day": 2,
    "body": "Father, the purity struggle is quieter this week and I do not trust quiet yet.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, the purity struggle is quieter this week and I do not trust quiet yet."
      }
    ],
    "subjects": [
      {
        "label": "purity",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "subh-pur-11",
    "category": "subject-sibling",
    "week": 58,
    "day": 3,
    "body": "God, I walked past the old door and did not open it. Thank you. I am still shaking.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, I walked past the old door and did not open it. Thank you. I am still shaking."
      }
    ],
    "subjects": [
      {
        "label": "porn",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-pur-12",
    "category": "subject-sibling",
    "week": 58,
    "day": 4,
    "body": "Lord, sexual temptation showed up in a boring afternoon, which is how it always shows up.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, sexual temptation showed up in a boring afternoon, which is how it always shows up."
      }
    ],
    "subjects": [
      {
        "label": "sexual temptation",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "subh-pur-13",
    "category": "subject-sibling",
    "week": 58,
    "day": 5,
    "body": "Jesus, I am asking for purity without the performance of being fine.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, I am asking for purity without the performance of being fine."
      }
    ],
    "subjects": [
      {
        "label": "purity",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-pur-14",
    "category": "subject-sibling",
    "week": 58,
    "day": 6,
    "body": "Father, porn is a subject I hate writing down and I am writing it down.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, porn is a subject I hate writing down and I am writing it down."
      }
    ],
    "subjects": [
      {
        "label": "porn",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "subh-pur-15",
    "category": "subject-sibling",
    "week": 59,
    "day": 0,
    "body": "God, keep me honest about sexual temptation when I would rather be vague.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, keep me honest about sexual temptation when I would rather be vague."
      }
    ],
    "subjects": [
      {
        "label": "sexual temptation",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "subh-pur-16",
    "category": "subject-sibling",
    "week": 59,
    "day": 1,
    "body": "Lord, I want a clean night. That is the purity prayer in one line.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, I want a clean night. That is the purity prayer in one line."
      }
    ],
    "subjects": [
      {
        "label": "purity",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "subh-virt-01",
    "category": "subject-virtue-name",
    "week": 60,
    "day": 0,
    "body": "Praying for Grace tonight — first day, new building, she will not say she is scared.",
    "passages": [
      {
        "type": "prayer",
        "text": "Praying for Grace tonight — first day, new building, she will not say she is scared."
      }
    ],
    "subjects": [
      {
        "label": "Grace",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Grace",
        "surfaceForms": [
          "Grace"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-02",
    "category": "subject-virtue-name",
    "week": 60,
    "day": 1,
    "body": "Lord, be with Joy in the interview. She has prepared and she is still shaking.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, be with Joy in the interview. She has prepared and she is still shaking."
      }
    ],
    "subjects": [
      {
        "label": "Joy",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Joy",
        "surfaceForms": [
          "Joy"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-03",
    "category": "subject-virtue-name",
    "week": 60,
    "day": 2,
    "body": "God, Hope starts treatment on Monday. I do not have a better sentence.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, Hope starts treatment on Monday. I do not have a better sentence."
      }
    ],
    "subjects": [
      {
        "label": "Hope",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Hope",
        "surfaceForms": [
          "Hope"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-04",
    "category": "subject-virtue-name",
    "week": 60,
    "day": 3,
    "body": "Father, Faith called and I did not know what to say, so I am saying this instead.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, Faith called and I did not know what to say, so I am saying this instead."
      }
    ],
    "subjects": [
      {
        "label": "Faith",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Faith",
        "surfaceForms": [
          "Faith"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-05",
    "category": "subject-virtue-name",
    "week": 60,
    "day": 4,
    "body": "Jesus, Mercy is carrying more than she will admit. Be near her kitchen table.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, Mercy is carrying more than she will admit. Be near her kitchen table."
      }
    ],
    "subjects": [
      {
        "label": "Mercy",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Mercy",
        "surfaceForms": [
          "Mercy"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-06",
    "category": "subject-virtue-name",
    "week": 60,
    "day": 5,
    "body": "Lord, give Grace one friend in that classroom who is kind without being loud.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, give Grace one friend in that classroom who is kind without being loud."
      }
    ],
    "subjects": [
      {
        "label": "Grace",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Grace",
        "surfaceForms": [
          "Grace"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-07",
    "category": "subject-virtue-name",
    "week": 60,
    "day": 6,
    "body": "I am asking for Joy to sleep the night before. She will not ask for herself.",
    "passages": [
      {
        "type": "prayer",
        "text": "I am asking for Joy to sleep the night before. She will not ask for herself."
      }
    ],
    "subjects": [
      {
        "label": "Joy",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Joy",
        "surfaceForms": [
          "Joy"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-08",
    "category": "subject-virtue-name",
    "week": 61,
    "day": 0,
    "body": "God, hold Hope when the waiting room does the thing waiting rooms do.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, hold Hope when the waiting room does the thing waiting rooms do."
      }
    ],
    "subjects": [
      {
        "label": "Hope",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Hope",
        "surfaceForms": [
          "Hope"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-09",
    "category": "subject-virtue-name",
    "week": 61,
    "day": 1,
    "body": "Father, Faith is not fine and I need you to be the one who says that with her.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, Faith is not fine and I need you to be the one who says that with her."
      }
    ],
    "subjects": [
      {
        "label": "Faith",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Faith",
        "surfaceForms": [
          "Faith"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-10",
    "category": "subject-virtue-name",
    "week": 61,
    "day": 2,
    "body": "Lord, Mercy asked me to pray and then changed the subject. I did not forget.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, Mercy asked me to pray and then changed the subject. I did not forget."
      }
    ],
    "subjects": [
      {
        "label": "Mercy",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Mercy",
        "surfaceForms": [
          "Mercy"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-11",
    "category": "subject-virtue-name",
    "week": 61,
    "day": 3,
    "body": "Jesus, walk Grace to the gate. She will look like she does not need it.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, walk Grace to the gate. She will look like she does not need it."
      }
    ],
    "subjects": [
      {
        "label": "Grace",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Grace",
        "surfaceForms": [
          "Grace"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-12",
    "category": "subject-virtue-name",
    "week": 61,
    "day": 4,
    "body": "God, Joy got the email and has not opened it. Sit with her until she does.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, Joy got the email and has not opened it. Sit with her until she does."
      }
    ],
    "subjects": [
      {
        "label": "Joy",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Joy",
        "surfaceForms": [
          "Joy"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-13",
    "category": "subject-virtue-name",
    "week": 61,
    "day": 5,
    "body": "Lord, Hope laughed today. Thank you for a laugh that was not a performance.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, Hope laughed today. Thank you for a laugh that was not a performance."
      }
    ],
    "subjects": [
      {
        "label": "Hope",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Hope",
        "surfaceForms": [
          "Hope"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-14",
    "category": "subject-virtue-name",
    "week": 61,
    "day": 6,
    "body": "Father, I keep confusing the word hope with the person Hope. Tonight I mean her.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, I keep confusing the word hope with the person Hope. Tonight I mean her."
      }
    ],
    "subjects": [
      {
        "label": "Hope",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Hope",
        "surfaceForms": [
          "Hope"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-15",
    "category": "subject-virtue-name",
    "week": 62,
    "day": 0,
    "body": "Lord, Grace is a girl, not a quality I am requesting. Be with the girl.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, Grace is a girl, not a quality I am requesting. Be with the girl."
      }
    ],
    "subjects": [
      {
        "label": "Grace",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Grace",
        "surfaceForms": [
          "Grace"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-virt-16",
    "category": "subject-virtue-name",
    "week": 62,
    "day": 1,
    "body": "God, I am not asking for joy. I am asking for Joy, who has a dentist appointment.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, I am not asking for joy. I am asking for Joy, who has a dentist appointment."
      }
    ],
    "subjects": [
      {
        "label": "Joy",
        "kind": "person"
      }
    ],
    "entities": [
      {
        "kind": "person",
        "canonical": "Joy",
        "surfaceForms": [
          "Joy"
        ]
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "subh-gen-01",
    "category": "subject-generic",
    "week": 63,
    "day": 0,
    "body": "Lord, give me wisdom today.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, give me wisdom today."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-02",
    "category": "subject-generic",
    "week": 63,
    "day": 1,
    "body": "Father, I need peace.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, I need peace."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-03",
    "category": "subject-generic",
    "week": 63,
    "day": 2,
    "body": "God, grant me strength.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, grant me strength."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-04",
    "category": "subject-generic",
    "week": 63,
    "day": 3,
    "body": "Jesus, more grace please.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, more grace please."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-05",
    "category": "subject-generic",
    "week": 63,
    "day": 4,
    "body": "Lord, I ask for patience.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, I ask for patience."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-06",
    "category": "subject-generic",
    "week": 63,
    "day": 5,
    "body": "Father, bless me.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, bless me."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-07",
    "category": "subject-generic",
    "week": 63,
    "day": 6,
    "body": "God, I need guidance.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, I need guidance."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-08",
    "category": "subject-generic",
    "week": 64,
    "day": 0,
    "body": "Jesus, help.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, help."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-09",
    "category": "subject-generic",
    "week": 64,
    "day": 1,
    "body": "Lord, give me clarity.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, give me clarity."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-10",
    "category": "subject-generic",
    "week": 64,
    "day": 2,
    "body": "Father, thank you. That is all.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, thank you. That is all."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-11",
    "category": "subject-generic",
    "week": 64,
    "day": 3,
    "body": "God, I want joy.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, I want joy."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-12",
    "category": "subject-generic",
    "week": 64,
    "day": 4,
    "body": "Lord, increase my faith.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, increase my faith."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-13",
    "category": "subject-generic",
    "week": 64,
    "day": 5,
    "body": "Father, I need rest as a quality, not a nap. I think. I am not sure.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, I need rest as a quality, not a nap. I think. I am not sure."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-14",
    "category": "subject-generic",
    "week": 64,
    "day": 6,
    "body": "Jesus, fill me with love.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, fill me with love."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-15",
    "category": "subject-generic",
    "week": 65,
    "day": 0,
    "body": "Lord, I am asking for breakthrough.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, I am asking for breakthrough."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-gen-16",
    "category": "subject-generic",
    "week": 65,
    "day": 1,
    "body": "God, give me confidence for the day.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, give me confidence for the day."
      }
    ],
    "subjects": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "subh-thr-naomi-01",
    "category": "subject-stoplist",
    "week": 64,
    "day": 2,
    "body": "God, Naomi had a better night. Thank you. Stay with the better night so it is not a fluke.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, Naomi had a better night. Thank you. Stay with the better night so it is not a fluke."
      }
    ],
    "subjects": [
      {
        "label": "Naomi",
        "kind": "person"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "subh-thr-naomi-02",
    "category": "subject-stoplist",
    "week": 66,
    "day": 2,
    "body": "Lord, I keep thinking about Naomi in the corridor. Be there when I cannot.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, I keep thinking about Naomi in the corridor. Be there when I cannot."
      }
    ],
    "subjects": [
      {
        "label": "Naomi",
        "kind": "person"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "subh-thr-front-01",
    "category": "subject-stoplist",
    "week": 64,
    "day": 2,
    "body": "Father, Frontier is hiring again and I do not know if that is mercy or a trap.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, Frontier is hiring again and I do not know if that is mercy or a trap."
      }
    ],
    "subjects": [
      {
        "label": "Frontier",
        "kind": "place"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "subh-thr-front-02",
    "category": "subject-stoplist",
    "week": 67,
    "day": 2,
    "body": "Jesus, I left Frontier at a reasonable hour. Help me do it twice.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, I left Frontier at a reasonable hour. Help me do it twice."
      }
    ],
    "subjects": [
      {
        "label": "Frontier",
        "kind": "place"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "subh-thr-anx-01",
    "category": "subject-stoplist",
    "week": 65,
    "day": 2,
    "body": "Lord, the anxiety came at lunch, not 4am, which I am choosing to notice.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, the anxiety came at lunch, not 4am, which I am choosing to notice."
      }
    ],
    "subjects": [
      {
        "label": "anxiety",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "subh-thr-anx-02",
    "category": "subject-stoplist",
    "week": 68,
    "day": 2,
    "body": "God, I named the anxiety out loud to Dan. Keep me from unsaying it.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, I named the anxiety out loud to Dan. Keep me from unsaying it."
      }
    ],
    "subjects": [
      {
        "label": "anxiety",
        "kind": "theme"
      }
    ],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "fear"
      ]
    }
  },
]
