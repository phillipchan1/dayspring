// Hard prayer-gate / span gold — cue-blind, cue false positives, about-prayer, mixed, sense vs feel.
//
// Synthetic gold for the Jev classifier lab. No real journal text.
// Drafted for coverage (cue-blind, hard negatives, mixed emotion, injection).
// Labels are protocol labels: a human should still adjudicate before shipping
// a threshold. See docs/lab/JEV_CLASSIFIER.md.

import type { CorpusEntry } from './types'

export const PRAYER_HARD_ENTRIES: CorpusEntry[] = [
  {
    "id": "prh-blind-01",
    "category": "prayer-hard",
    "week": 40,
    "day": 0,
    "body": "Hospital car park again. I sat with the engine off.\n\nPlease just let the numbers be ordinary tomorrow. I have no clever words left.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Please just let the numbers be ordinary tomorrow. I have no clever words left."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-02",
    "category": "prayer-hard",
    "week": 40,
    "day": 1,
    "body": "Hospital car park again. I sat with the engine off.\n\nKeep her breathing even. That is the whole sentence.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Keep her breathing even. That is the whole sentence."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-blind-03",
    "category": "prayer-hard",
    "week": 40,
    "day": 2,
    "body": "Hospital car park again. I sat with the engine off.\n\nI am handing Thursday over because I cannot sit with it overnight again.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "I am handing Thursday over because I cannot sit with it overnight again."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-04",
    "category": "prayer-hard",
    "week": 40,
    "day": 3,
    "body": "Hospital car park again. I sat with the engine off.\n\nIf you are listening, do the small thing I cannot do from here.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "If you are listening, do the small thing I cannot do from here."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-blind-05",
    "category": "prayer-hard",
    "week": 40,
    "day": 4,
    "body": "Hospital car park again. I sat with the engine off.\n\nTake the 3am hour. I keep waking into it like it is a room I do not own.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Take the 3am hour. I keep waking into it like it is a room I do not own."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-06",
    "category": "prayer-hard",
    "week": 40,
    "day": 5,
    "body": "Hospital car park again. I sat with the engine off.\n\nHold the kids while I am at the office. I mean that literally and I do not know how else to say it.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Hold the kids while I am at the office. I mean that literally and I do not know how else to say it."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-blind-07",
    "category": "prayer-hard",
    "week": 40,
    "day": 6,
    "body": "Hospital car park again. I sat with the engine off.\n\nPlease let him sleep. I will take a short night if he gets a long one.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Please let him sleep. I will take a short night if he gets a long one."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-08",
    "category": "prayer-hard",
    "week": 41,
    "day": 0,
    "body": "Hospital car park again. I sat with the engine off.\n\nI am asking again about the scan. Same ask. I have not found a better one.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "I am asking again about the scan. Same ask. I have not found a better one."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-blind-09",
    "category": "prayer-hard",
    "week": 41,
    "day": 1,
    "body": "Hospital car park again. I sat with the engine off.\n\nStay near the hospital corridor. I cannot be in two buildings.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Stay near the hospital corridor. I cannot be in two buildings."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-10",
    "category": "prayer-hard",
    "week": 41,
    "day": 2,
    "body": "Hospital car park again. I sat with the engine off.\n\nUndo what I said at dinner. I heard it the way she heard it.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Undo what I said at dinner. I heard it the way she heard it."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-blind-11",
    "category": "prayer-hard",
    "week": 41,
    "day": 3,
    "body": "Hospital car park again. I sat with the engine off.\n\nMake a way through Friday that does not require me to be impressive.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Make a way through Friday that does not require me to be impressive."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-12",
    "category": "prayer-hard",
    "week": 41,
    "day": 4,
    "body": "Hospital car park again. I sat with the engine off.\n\nCatch Naomi before she decides she is a burden. She is not.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Catch Naomi before she decides she is a burden. She is not."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-blind-13",
    "category": "prayer-hard",
    "week": 41,
    "day": 5,
    "body": "Hospital car park again. I sat with the engine off.\n\nI do not have language. You have the situation. That is the ask.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "I do not have language. You have the situation. That is the ask."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-14",
    "category": "prayer-hard",
    "week": 41,
    "day": 6,
    "body": "Hospital car park again. I sat with the engine off.\n\nPlease let the interview be a conversation and not a performance.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Please let the interview be a conversation and not a performance."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-blind-15",
    "category": "prayer-hard",
    "week": 42,
    "day": 0,
    "body": "Hospital car park again. I sat with the engine off.\n\nSit with Ada in the new classroom. She will not say she is frightened.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Sit with Ada in the new classroom. She will not say she is frightened."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-16",
    "category": "prayer-hard",
    "week": 42,
    "day": 1,
    "body": "Hospital car park again. I sat with the engine off.\n\nI am putting the money worry down here. I will pick it up again; I know myself. Still.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "I am putting the money worry down here. I will pick it up again; I know myself. Still."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-blind-17",
    "category": "prayer-hard",
    "week": 42,
    "day": 2,
    "body": "Hospital car park again. I sat with the engine off.\n\nBe in the room before I get there. I walk in already behind.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Be in the room before I get there. I walk in already behind."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-18",
    "category": "prayer-hard",
    "week": 42,
    "day": 3,
    "body": "Hospital car park again. I sat with the engine off.\n\nPlease let the apology land. I have rewritten it four times and sent none.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Please let the apology land. I have rewritten it four times and sent none."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-blind-19",
    "category": "prayer-hard",
    "week": 42,
    "day": 4,
    "body": "Hospital car park again. I sat with the engine off.\n\nKeep the night from becoming a story I tell badly tomorrow.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "Keep the night from becoming a story I tell badly tomorrow."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "prh-blind-20",
    "category": "prayer-hard",
    "week": 42,
    "day": 5,
    "body": "Hospital car park again. I sat with the engine off.\n\nI am asking for one true thing to say to him. Not a speech.\n\nThen I went in.",
    "passages": [
      {
        "type": "prayer",
        "text": "I am asking for one true thing to say to him. Not a speech."
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-fp-01",
    "category": "prayer-hard",
    "week": 44,
    "day": 0,
    "body": "Pastor prayed for the church at the end and then we stacked chairs. I did the small chairs.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-02",
    "category": "prayer-hard",
    "week": 44,
    "day": 1,
    "body": "The prayer meeting moved rooms. I sent the email. Two people asked where the old room went.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-03",
    "category": "prayer-hard",
    "week": 44,
    "day": 2,
    "body": "Sermon was about mercy. He used a fishing story. I thought about what to cook.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-04",
    "category": "prayer-hard",
    "week": 44,
    "day": 3,
    "body": "Worship team asked me to bring cables. I brought cables. That is the spiritual gift I actually have.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-05",
    "category": "prayer-hard",
    "week": 44,
    "day": 4,
    "body": "Someone said grace over lunch and I said amen out of habit while looking at my phone.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-06",
    "category": "prayer-hard",
    "week": 44,
    "day": 5,
    "body": "The youth group is doing a 24-hour prayer thing. I signed the rota for 2am because nobody else would.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-07",
    "category": "prayer-hard",
    "week": 44,
    "day": 6,
    "body": "Read a thread about faith in public life. Bookmarked it. Did not pray. Did not mean to.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-08",
    "category": "prayer-hard",
    "week": 45,
    "day": 0,
    "body": "Church newsletter: bless the bake sale. I can bring brownies. That is the whole item.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-09",
    "category": "prayer-hard",
    "week": 45,
    "day": 1,
    "body": "Dan said he has been praying for me. I said thanks. I changed the subject to the boiler.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-10",
    "category": "prayer-hard",
    "week": 45,
    "day": 2,
    "body": "The phrase \"I feel like God is doing something\" was on a poster in the hall. I walked past it.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-11",
    "category": "prayer-hard",
    "week": 45,
    "day": 3,
    "body": "We talked about intercession as a ministry model for forty minutes. I drew boxes in my notebook.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-12",
    "category": "prayer-hard",
    "week": 45,
    "day": 4,
    "body": "She asked if I had a word from the Lord. I said I had a parking space. She did not laugh.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-13",
    "category": "prayer-hard",
    "week": 45,
    "day": 5,
    "body": "Bible study notes: write down what the passage is saying. I wrote \"be kind\". We moved on.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-14",
    "category": "prayer-hard",
    "week": 45,
    "day": 6,
    "body": "The app sent a verse of the day. I dismissed the notification to see the weather.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-15",
    "category": "prayer-hard",
    "week": 46,
    "day": 0,
    "body": "Someone at work said \"thoughts and prayers\" in an email about a deadline. I replied with the spreadsheet.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-16",
    "category": "prayer-hard",
    "week": 46,
    "day": 1,
    "body": "The kids did a nativity. Joseph forgot his line. We clapped. I thought about traffic.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-17",
    "category": "prayer-hard",
    "week": 46,
    "day": 2,
    "body": "A friend forwarded a hallelujah video. I liked it. I did not watch it.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-18",
    "category": "prayer-hard",
    "week": 46,
    "day": 3,
    "body": "Committee minutes: opening prayer by Sandra, closing prayer by Tom. I minuted both.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-19",
    "category": "prayer-hard",
    "week": 46,
    "day": 4,
    "body": "I told the story of last year's answered prayer at dinner because someone asked. It is a story now, not a prayer.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fp-20",
    "category": "prayer-hard",
    "week": 46,
    "day": 5,
    "body": "The phrase on my heart is a song lyric I cannot place. I hummed it doing dishes.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-01",
    "category": "prayer-hard",
    "week": 48,
    "day": 0,
    "body": "I have been thinking about prayer a lot. I still did not do any. I made a list of why.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-02",
    "category": "prayer-hard",
    "week": 48,
    "day": 1,
    "body": "People talk about prayer like it is a skill. I used to believe that. I am less sure.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-03",
    "category": "prayer-hard",
    "week": 48,
    "day": 2,
    "body": "I watched her pray and I felt like I was looking through a window I do not have a key to.",
    "passages": [],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "prh-about-04",
    "category": "prayer-hard",
    "week": 48,
    "day": 3,
    "body": "We discussed whether prayer changes things or changes us. Nobody won. I did the washing up.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-05",
    "category": "prayer-hard",
    "week": 48,
    "day": 4,
    "body": "I used to write long prayers. Now I write about why I do not. This is one of those.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-06",
    "category": "prayer-hard",
    "week": 48,
    "day": 5,
    "body": "He said prayer is just attention. I wrote that down. I still did not attend.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-07",
    "category": "prayer-hard",
    "week": 48,
    "day": 6,
    "body": "I am trying to remember the last time I actually asked for something instead of analysing asking.",
    "passages": [],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "prh-about-08",
    "category": "prayer-hard",
    "week": 49,
    "day": 0,
    "body": "The book says we should pray without ceasing. I ceased. I am recording the cease.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-09",
    "category": "prayer-hard",
    "week": 49,
    "day": 1,
    "body": "I told someone I would pray and then I thought about them, which is not the same, and I know it.",
    "passages": [],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "prh-about-10",
    "category": "prayer-hard",
    "week": 49,
    "day": 2,
    "body": "Prayer as a topic is easy. Prayer as a sentence addressed to someone is the thing I keep walking around.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-11",
    "category": "prayer-hard",
    "week": 49,
    "day": 3,
    "body": "I researched how other people pray. I have notes. I have not used the notes.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-12",
    "category": "prayer-hard",
    "week": 49,
    "day": 4,
    "body": "She asked me to teach a workshop on prayer. I said yes. I have a slide deck and no practice.",
    "passages": [],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "prh-about-13",
    "category": "prayer-hard",
    "week": 49,
    "day": 5,
    "body": "I keep a journal so I will pray. Tonight I journaled about the keeping.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-14",
    "category": "prayer-hard",
    "week": 49,
    "day": 6,
    "body": "There is a difference between wanting to be a person who prays and praying. I am in the first camp today.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-about-15",
    "category": "prayer-hard",
    "week": 50,
    "day": 0,
    "body": "I outlined a theology of petition on the train. Very tidy. Addressed to nobody.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-mix-01",
    "category": "prayer-hard",
    "week": 51,
    "day": 0,
    "body": "The train was late. I bought a dry sandwich.\n\nLord, I am tired of performing competence at Frontier.\n\nThen I answered three emails about a spreadsheet nobody will open.",
    "passages": [
      {
        "type": "prayer",
        "text": "Lord, I am tired of performing competence at Frontier."
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
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-mix-02",
    "category": "prayer-hard",
    "week": 51,
    "day": 1,
    "body": "Naomi texted a photo of the waiting room chairs.\n\nBe near her. I cannot get there before six.\n\nI heated soup. The soup was fine.",
    "passages": [
      {
        "type": "prayer",
        "text": "Be near her. I cannot get there before six."
      }
    ],
    "subjects": [
      {
        "label": "Naomi",
        "kind": "person"
      }
    ],
    "defect": "cue-blind-prayer",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-mix-03",
    "category": "prayer-hard",
    "week": 51,
    "day": 2,
    "body": "I walked the long way home.\n\nFather, the anxiety is doing the 4am thing again. Take it or sit with it, I do not mind which.\n\nA fox crossed the road like it had an appointment.",
    "passages": [
      {
        "type": "prayer",
        "text": "Father, the anxiety is doing the 4am thing again. Take it or sit with it, I do not mind which."
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
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-mix-04",
    "category": "prayer-hard",
    "week": 51,
    "day": 3,
    "body": "Paid the water bill.\n\nJesus, I keep picking up Frontier again. Show me what is actually mine.\n\nThen I sorted recycling.",
    "passages": [
      {
        "type": "prayer",
        "text": "Jesus, I keep picking up Frontier again. Show me what is actually mine."
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
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-mix-05",
    "category": "prayer-hard",
    "week": 51,
    "day": 4,
    "body": "Ada asked why I was quiet.\n\nGod, make me the kind of parent she does not have to decode.\n\nI said I was thinking about work, which was half true.",
    "passages": [
      {
        "type": "prayer",
        "text": "God, make me the kind of parent she does not have to decode."
      }
    ],
    "subjects": [
      {
        "label": "Ada",
        "kind": "person"
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
    "id": "prh-sense-01",
    "category": "prayer-hard",
    "week": 52,
    "day": 0,
    "body": "I was washing up and it landed, not as a voice, as a knowing: stop treating the delay as a verdict.",
    "passages": [
      {
        "type": "sense",
        "text": "it landed, not as a voice, as a knowing: stop treating the delay as a verdict."
      }
    ],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-sense-02",
    "category": "prayer-hard",
    "week": 52,
    "day": 1,
    "body": "Halfway down the hill I felt the Lord leading me to call Naomi before I got home. I called.",
    "passages": [
      {
        "type": "sense",
        "text": "I felt the Lord leading me to call Naomi before I got home."
      }
    ],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-sense-03",
    "category": "prayer-hard",
    "week": 52,
    "day": 2,
    "body": "I feel tired. That is all. The weather, the week, the bed.",
    "passages": [],
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "prh-sense-04",
    "category": "prayer-hard",
    "week": 52,
    "day": 3,
    "body": "I feel like the meeting went fine. Dan disagrees. We will find out on Friday.",
    "passages": [],
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-sense-05",
    "category": "prayer-hard",
    "week": 52,
    "day": 4,
    "body": "I feel like God is crowding the edges of this, which I would not have said last month.",
    "passages": [
      {
        "type": "sense",
        "text": "I feel like God is crowding the edges of this, which I would not have said last month."
      }
    ],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-sense-06",
    "category": "prayer-hard",
    "week": 52,
    "day": 5,
    "body": "An impression I cannot shake: leave the email unsent until Monday.",
    "passages": [
      {
        "type": "sense",
        "text": "An impression I cannot shake: leave the email unsent until Monday."
      }
    ],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-sense-07",
    "category": "prayer-hard",
    "week": 52,
    "day": 6,
    "body": "I feel cold. I should have brought the good coat. That is the feeling.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-sense-08",
    "category": "prayer-hard",
    "week": 52,
    "day": 0,
    "body": "He is saying, I think, that I do not have to win this one. I wrote it down to test it tomorrow.",
    "passages": [
      {
        "type": "sense",
        "text": "He is saying, I think, that I do not have to win this one."
      }
    ],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-sense-09",
    "category": "prayer-hard",
    "week": 52,
    "day": 1,
    "body": "I feel like going to bed. I am going to bed. Not a leading. A bedtime.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-sense-10",
    "category": "prayer-hard",
    "week": 52,
    "day": 2,
    "body": "On my heart in the specific way: text Dan the truth, not the tidy version.",
    "passages": [
      {
        "type": "sense",
        "text": "On my heart in the specific way: text Dan the truth, not the tidy version."
      }
    ],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fence-01",
    "category": "prayer-hard",
    "week": 53,
    "day": 0,
    "body": "<!-- ritual:name:Lectio Divina -->\n> The Lord is my shepherd; I shall not want. (v. 1)\n<!-- ritual:end -->\n\nThen I made coffee and thought about the week. The verse stayed in the fence.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "prh-fence-02",
    "category": "prayer-hard",
    "week": 53,
    "day": 1,
    "body": "<!-- ritual:name:SOAP -->\n> Be still, and know that I am God. (v. 10)\n<!-- ritual:end -->\n\nI wrote a shopping list under it. Milk, bread, the thing for the tap.",
    "passages": [],
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
]
