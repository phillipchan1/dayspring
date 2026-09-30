// Sentiment gold — explicit, inferred, negated, other-person, mixed, absent.
//
// Synthetic gold for the Jev classifier lab. No real journal text.
// Drafted for coverage (cue-blind, hard negatives, mixed emotion, injection).
// Labels are protocol labels: a human should still adjudicate before shipping
// a threshold. See docs/lab/JEV_CLASSIFIER.md.

import type { CorpusEntry } from './types'

export const SENTIMENT_ENTRIES: CorpusEntry[] = [
  {
    "id": "sen-exp-joy-01",
    "category": "sentiment-explicit",
    "week": 20,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt happy walking home after the call.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-exp-joy-02",
    "category": "sentiment-explicit",
    "week": 20,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was glad the scan was clear.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-exp-joy-03",
    "category": "sentiment-explicit",
    "week": 20,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt delighted when Ada ran to the door.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-exp-joy-04",
    "category": "sentiment-explicit",
    "week": 20,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI am so happy I could cry, and they would be good tears.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-exp-joy-05",
    "category": "sentiment-explicit",
    "week": 20,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt genuinely glad for the first time in weeks.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-exp-joy-06",
    "category": "sentiment-explicit",
    "week": 20,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was happy in a quiet way, nothing dramatic.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-exp-peace-01",
    "category": "sentiment-explicit",
    "week": 20,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt calm after I put the phone down.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-exp-peace-02",
    "category": "sentiment-explicit",
    "week": 21,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was settled for once. No argument running in my head.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-exp-peace-03",
    "category": "sentiment-explicit",
    "week": 21,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt at rest on the walk, which almost never happens.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-exp-peace-04",
    "category": "sentiment-explicit",
    "week": 21,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nA quiet peace sat on me through the meeting.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-exp-peace-05",
    "category": "sentiment-explicit",
    "week": 21,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt calm enough to sleep without the list.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-exp-peace-06",
    "category": "sentiment-explicit",
    "week": 21,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was at peace with leaving the email unsent.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-exp-gratitude-01",
    "category": "sentiment-explicit",
    "week": 21,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt thankful for the neighbour who brought soup.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-exp-gratitude-02",
    "category": "sentiment-explicit",
    "week": 21,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was grateful she called even though she had nothing new.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-exp-gratitude-03",
    "category": "sentiment-explicit",
    "week": 22,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nThankful tonight. Just that. The ordinary kind.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-exp-gratitude-04",
    "category": "sentiment-explicit",
    "week": 22,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt grateful for a boring Tuesday.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-exp-gratitude-05",
    "category": "sentiment-explicit",
    "week": 22,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nI am thankful the car started.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-exp-gratitude-06",
    "category": "sentiment-explicit",
    "week": 22,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt thankfulness I did not manufacture.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-exp-hope-01",
    "category": "sentiment-explicit",
    "week": 22,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt hopeful about Thursday in a way I do not usually allow.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "sen-exp-hope-02",
    "category": "sentiment-explicit",
    "week": 22,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was expectant this morning, which is unlike me.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "sen-exp-hope-03",
    "category": "sentiment-explicit",
    "week": 22,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nA small hope showed up and I did not chase it off.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "sen-exp-hope-04",
    "category": "sentiment-explicit",
    "week": 23,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI feel hopeful that the next scan will be quieter.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "sen-exp-hope-05",
    "category": "sentiment-explicit",
    "week": 23,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was hopeful enough to book the later train.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "sen-exp-hope-06",
    "category": "sentiment-explicit",
    "week": 23,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nHope sat down next to the fear and stayed.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "sen-exp-love-01",
    "category": "sentiment-explicit",
    "week": 23,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt such tenderness toward her when she fell asleep on the sofa.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-exp-love-02",
    "category": "sentiment-explicit",
    "week": 23,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI love him in the unspectacular way that does the dishes.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-exp-love-03",
    "category": "sentiment-explicit",
    "week": 23,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt love for Ada that had no advice attached.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-exp-love-04",
    "category": "sentiment-explicit",
    "week": 23,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was full of affection I did not know what to do with.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-exp-love-05",
    "category": "sentiment-explicit",
    "week": 24,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt a sudden love for this ordinary kitchen.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-exp-love-06",
    "category": "sentiment-explicit",
    "week": 24,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI love them and I am not trying to fix them tonight.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-exp-longing-01",
    "category": "sentiment-explicit",
    "week": 24,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nI miss her voice. I keep almost texting a number that does not ring.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "sen-exp-longing-02",
    "category": "sentiment-explicit",
    "week": 24,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt a longing for home that is not about the house.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "sen-exp-longing-03",
    "category": "sentiment-explicit",
    "week": 24,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI ache for the version of us that could sit without talking.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "sen-exp-longing-04",
    "category": "sentiment-explicit",
    "week": 24,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI yearn for a morning that is not already behind.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "sen-exp-longing-05",
    "category": "sentiment-explicit",
    "week": 24,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nI miss the way the house sounded when everyone was still here.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "sen-exp-longing-06",
    "category": "sentiment-explicit",
    "week": 25,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nA homesick feeling I cannot place sat on my chest.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "sen-exp-sadness-01",
    "category": "sentiment-explicit",
    "week": 25,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt sad in the car and I let it be sad.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "sadness"
      ]
    }
  },
  {
    "id": "sen-exp-sadness-02",
    "category": "sentiment-explicit",
    "week": 25,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was down all afternoon for no useful reason.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "sadness"
      ]
    }
  },
  {
    "id": "sen-exp-sadness-03",
    "category": "sentiment-explicit",
    "week": 25,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nA sorrow I cannot name sat with me at the table.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "sadness"
      ]
    }
  },
  {
    "id": "sen-exp-sadness-04",
    "category": "sentiment-explicit",
    "week": 25,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt sorrowful after I hung up.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "sadness"
      ]
    }
  },
  {
    "id": "sen-exp-sadness-05",
    "category": "sentiment-explicit",
    "week": 25,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI am sad about the way that conversation ended.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "sadness"
      ]
    }
  },
  {
    "id": "sen-exp-sadness-06",
    "category": "sentiment-explicit",
    "week": 25,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt a quiet sadness that did not ask to be solved.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "sadness"
      ]
    }
  },
  {
    "id": "sen-exp-grief-01",
    "category": "sentiment-explicit",
    "week": 26,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI am still mourning him. The anniversary is next week.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "grief"
      ]
    }
  },
  {
    "id": "sen-exp-grief-02",
    "category": "sentiment-explicit",
    "week": 26,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nGrief arrived at 3pm like it had a key.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "grief"
      ]
    }
  },
  {
    "id": "sen-exp-grief-03",
    "category": "sentiment-explicit",
    "week": 26,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt the loss of her again in the grocery aisle.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "grief"
      ]
    }
  },
  {
    "id": "sen-exp-grief-04",
    "category": "sentiment-explicit",
    "week": 26,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI am grieving the life we did not get to have.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "grief"
      ]
    }
  },
  {
    "id": "sen-exp-grief-05",
    "category": "sentiment-explicit",
    "week": 26,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nThe funeral was months ago and I am still in it.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "grief"
      ]
    }
  },
  {
    "id": "sen-exp-grief-06",
    "category": "sentiment-explicit",
    "week": 26,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI mourned in the parking lot where nobody could see.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "grief"
      ]
    }
  },
  {
    "id": "sen-exp-fear-01",
    "category": "sentiment-explicit",
    "week": 26,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt afraid when the phone lit up with the hospital prefix.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "sen-exp-fear-02",
    "category": "sentiment-explicit",
    "week": 27,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was scared the whole drive there.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "sen-exp-fear-03",
    "category": "sentiment-explicit",
    "week": 27,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt threatened by a silence I could not interpret.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "sen-exp-fear-04",
    "category": "sentiment-explicit",
    "week": 27,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nI am afraid of what Thursday will say.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "sen-exp-fear-05",
    "category": "sentiment-explicit",
    "week": 27,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt fear in my hands, which is a new place for it.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "sen-exp-fear-06",
    "category": "sentiment-explicit",
    "week": 27,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was afraid to open the envelope.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "sen-exp-anger-01",
    "category": "sentiment-explicit",
    "week": 27,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was furious about the way they spoke to her.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    }
  },
  {
    "id": "sen-exp-anger-02",
    "category": "sentiment-explicit",
    "week": 27,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt angry in a clean way, not the stew I usually make.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    }
  },
  {
    "id": "sen-exp-anger-03",
    "category": "sentiment-explicit",
    "week": 28,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI am frustrated that nobody will say the obvious thing.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    }
  },
  {
    "id": "sen-exp-anger-04",
    "category": "sentiment-explicit",
    "week": 28,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was angry at the email and then at myself for being angry.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    }
  },
  {
    "id": "sen-exp-anger-05",
    "category": "sentiment-explicit",
    "week": 28,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nA hot anger sat in my throat through dinner.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    }
  },
  {
    "id": "sen-exp-anger-06",
    "category": "sentiment-explicit",
    "week": 28,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt furious and I did not spiritualize it.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    }
  },
  {
    "id": "sen-exp-shame-01",
    "category": "sentiment-explicit",
    "week": 28,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt ashamed of how I snapped at Ada.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "sen-exp-shame-02",
    "category": "sentiment-explicit",
    "week": 28,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was ashamed to be seen in that room.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "sen-exp-shame-03",
    "category": "sentiment-explicit",
    "week": 28,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nA shame I know too well walked in with me.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "sen-exp-shame-04",
    "category": "sentiment-explicit",
    "week": 29,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI feel exposed and small about the money thing.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "sen-exp-shame-05",
    "category": "sentiment-explicit",
    "week": 29,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was ashamed of the voicemail I left.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "sen-exp-shame-06",
    "category": "sentiment-explicit",
    "week": 29,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt unworthy of the kindness and I hated that feeling.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "sen-exp-confusion-01",
    "category": "sentiment-explicit",
    "week": 29,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt confused about what I am supposed to want.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "sen-exp-confusion-02",
    "category": "sentiment-explicit",
    "week": 29,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI am lost on this decision and pretending I am not.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "sen-exp-confusion-03",
    "category": "sentiment-explicit",
    "week": 29,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt unsure what is true in that conversation.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "sen-exp-confusion-04",
    "category": "sentiment-explicit",
    "week": 29,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was confused after the meeting and stayed confused.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "sen-exp-confusion-05",
    "category": "sentiment-explicit",
    "week": 30,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI do not know which version of the story to believe.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "sen-exp-confusion-06",
    "category": "sentiment-explicit",
    "week": 30,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nA fog sat on the choice and I could not see through it.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "sen-exp-weariness-01",
    "category": "sentiment-explicit",
    "week": 30,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt tired in my bones, not just my eyes.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "sen-exp-weariness-02",
    "category": "sentiment-explicit",
    "week": 30,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was exhausted by 10am and the day was not done.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "sen-exp-weariness-03",
    "category": "sentiment-explicit",
    "week": 30,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI feel depleted and I am not performing energy.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "sen-exp-weariness-04",
    "category": "sentiment-explicit",
    "week": 30,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was tired of being the one who remembers.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "sen-exp-weariness-05",
    "category": "sentiment-explicit",
    "week": 30,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nA deep weariness sat down and did not get up.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "sen-exp-weariness-06",
    "category": "sentiment-explicit",
    "week": 31,
    "day": 0,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt exhausted by kindness I did not have.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "sen-exp-stress-01",
    "category": "sentiment-explicit",
    "week": 31,
    "day": 1,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt stressed about the deadline in a body way.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "sen-exp-stress-02",
    "category": "sentiment-explicit",
    "week": 31,
    "day": 2,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was tense all morning and my jaw hurt.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "sen-exp-stress-03",
    "category": "sentiment-explicit",
    "week": 31,
    "day": 3,
    "body": "Came home later than I meant to. The sink was still full.\n\nI feel pressured from every side of the calendar.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "sen-exp-stress-04",
    "category": "sentiment-explicit",
    "week": 31,
    "day": 4,
    "body": "Came home later than I meant to. The sink was still full.\n\nI was overwhelmed by the inbox and I closed it.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "sen-exp-stress-05",
    "category": "sentiment-explicit",
    "week": 31,
    "day": 5,
    "body": "Came home later than I meant to. The sink was still full.\n\nA tight stress sat in my shoulders through the call.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "sen-exp-stress-06",
    "category": "sentiment-explicit",
    "week": 31,
    "day": 6,
    "body": "Came home later than I meant to. The sink was still full.\n\nI felt tense waiting for a reply that did not come.\n\nI made tea and did not drink it.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "sen-inf-joy-01",
    "category": "sentiment-inferred",
    "week": 32,
    "day": 0,
    "body": "Ordinary Tuesday. Rain again.\n\nAda drew a sun on the steamed window and I stood there longer than I needed to, smiling at glass.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-inf-peace-01",
    "category": "sentiment-inferred",
    "week": 32,
    "day": 1,
    "body": "Ordinary Tuesday. Rain again.\n\nThe house finally went quiet and I did not fill it. I sat. That was the whole evening.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-inf-gratitude-01",
    "category": "sentiment-inferred",
    "week": 32,
    "day": 2,
    "body": "Ordinary Tuesday. Rain again.\n\nSomeone left eggs on the step. I stood there with the carton like it was a letter.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-inf-hope-01",
    "category": "sentiment-inferred",
    "week": 32,
    "day": 3,
    "body": "Ordinary Tuesday. Rain again.\n\nI bought two tickets for a month from now. I have not done that in a year.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "sen-inf-love-01",
    "category": "sentiment-inferred",
    "week": 32,
    "day": 4,
    "body": "Ordinary Tuesday. Rain again.\n\nI folded his shirts the way he likes and I did not mention it. I just did it.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-inf-longing-01",
    "category": "sentiment-inferred",
    "week": 32,
    "day": 5,
    "body": "Ordinary Tuesday. Rain again.\n\nI set a third place at the table before I remembered and then I left it.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "sen-inf-sadness-01",
    "category": "sentiment-inferred",
    "week": 32,
    "day": 6,
    "body": "Ordinary Tuesday. Rain again.\n\nI sat in the car after I parked and did not go in for a long time.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "sadness"
      ]
    }
  },
  {
    "id": "sen-inf-grief-01",
    "category": "sentiment-inferred",
    "week": 33,
    "day": 0,
    "body": "Ordinary Tuesday. Rain again.\n\nHis jacket is still on the hook. I walked past it and my hands went empty.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "grief"
      ]
    }
  },
  {
    "id": "sen-inf-fear-01",
    "category": "sentiment-inferred",
    "week": 33,
    "day": 1,
    "body": "Ordinary Tuesday. Rain again.\n\nI checked the lock twice and then a third time and I still stood there listening.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "sen-inf-anger-01",
    "category": "sentiment-inferred",
    "week": 33,
    "day": 2,
    "body": "Ordinary Tuesday. Rain again.\n\nI closed the laptop harder than the laptop deserved and left the room.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    }
  },
  {
    "id": "sen-inf-shame-01",
    "category": "sentiment-inferred",
    "week": 33,
    "day": 3,
    "body": "Ordinary Tuesday. Rain again.\n\nI reread the message I sent and put the phone face down like it could see me.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "sen-inf-confusion-01",
    "category": "sentiment-inferred",
    "week": 33,
    "day": 4,
    "body": "Ordinary Tuesday. Rain again.\n\nI started the email four times and deleted four beginnings. I still do not know the sentence.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "sen-inf-weariness-01",
    "category": "sentiment-inferred",
    "week": 33,
    "day": 5,
    "body": "Ordinary Tuesday. Rain again.\n\nI sat on the edge of the bed with one shoe on and could not make the other foot move.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "sen-inf-stress-01",
    "category": "sentiment-inferred",
    "week": 33,
    "day": 6,
    "body": "Ordinary Tuesday. Rain again.\n\nI watched the clock and the clock watched back. My shoulders were up by my ears.\n\nLater I heated leftovers.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "sen-neg-01",
    "category": "sentiment-negated",
    "week": 34,
    "day": 0,
    "body": "Wrote this after dinner.\n\nI am not angry, just tired of repeating myself.\n\nThen I washed the pan.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    },
    "note": "Denied anger; do not assign the denied label."
  },
  {
    "id": "sen-neg-02",
    "category": "sentiment-negated",
    "week": 34,
    "day": 1,
    "body": "Wrote this after dinner.\n\nI am not afraid of the appointment. I am just worn out from waiting.\n\nThen I washed the pan.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    },
    "note": "Denied fear; do not assign the denied label."
  },
  {
    "id": "sen-neg-03",
    "category": "sentiment-negated",
    "week": 34,
    "day": 2,
    "body": "Wrote this after dinner.\n\nI am not happy about it. I am relieved it is over, which is different.\n\nThen I washed the pan.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "note": "Denied joy; do not assign the denied label."
  },
  {
    "id": "sen-neg-04",
    "category": "sentiment-negated",
    "week": 34,
    "day": 3,
    "body": "Wrote this after dinner.\n\nI am not sad, I am just quiet. The day was long.\n\nThen I washed the pan.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    },
    "note": "Denied sadness; do not assign the denied label."
  },
  {
    "id": "sen-neg-05",
    "category": "sentiment-negated",
    "week": 34,
    "day": 4,
    "body": "Wrote this after dinner.\n\nI am not stressed. I am bored, which I keep misreading as urgency.\n\nThen I washed the pan.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "note": "Denied stress; do not assign the denied label."
  },
  {
    "id": "sen-neg-06",
    "category": "sentiment-negated",
    "week": 34,
    "day": 5,
    "body": "Wrote this after dinner.\n\nI am not ashamed of asking. I am tired of pretending I do not need help.\n\nThen I washed the pan.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    },
    "note": "Denied shame; do not assign the denied label."
  },
  {
    "id": "sen-neg-07",
    "category": "sentiment-negated",
    "week": 34,
    "day": 6,
    "body": "Wrote this after dinner.\n\nI am not grieving tonight. I am actually alright, and I am allowed to be.\n\nThen I washed the pan.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "note": "Denied grief; do not assign the denied label."
  },
  {
    "id": "sen-neg-08",
    "category": "sentiment-negated",
    "week": 35,
    "day": 0,
    "body": "Wrote this after dinner.\n\nI am not hopeful. I am just out of other plans.\n\nThen I washed the pan.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "note": "Denied hope; do not assign the denied label."
  },
  {
    "id": "sen-neg-09",
    "category": "sentiment-negated",
    "week": 35,
    "day": 1,
    "body": "Wrote this after dinner.\n\nI am not at peace. I am holding still so I do not make it worse.\n\nThen I washed the pan.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "note": "Denied peace; do not assign the denied label."
  },
  {
    "id": "sen-neg-10",
    "category": "sentiment-negated",
    "week": 35,
    "day": 2,
    "body": "Wrote this after dinner.\n\nI do not feel loving. I feel obligated, and I am naming that honestly.\n\nThen I washed the pan.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "note": "Denied love; do not assign the denied label."
  },
  {
    "id": "sen-neg-11",
    "category": "sentiment-negated",
    "week": 35,
    "day": 3,
    "body": "Wrote this after dinner.\n\nI am not grateful for the lesson. I wanted the thing, not the lesson.\n\nThen I washed the pan.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "note": "Denied gratitude; do not assign the denied label."
  },
  {
    "id": "sen-neg-12",
    "category": "sentiment-negated",
    "week": 35,
    "day": 4,
    "body": "Wrote this after dinner.\n\nI am not confused. I know exactly what happened and I do not like it.\n\nThen I washed the pan.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    },
    "note": "Denied confusion; do not assign the denied label."
  },
  {
    "id": "sen-neg-13",
    "category": "sentiment-negated",
    "week": 35,
    "day": 5,
    "body": "Wrote this after dinner.\n\nI am not tired. I am restless, which is worse.\n\nThen I washed the pan.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    },
    "note": "Denied weariness; do not assign the denied label."
  },
  {
    "id": "sen-neg-14",
    "category": "sentiment-negated",
    "week": 35,
    "day": 6,
    "body": "Wrote this after dinner.\n\nI do not miss him. I miss the version of me that existed around him, and that is not the same.\n\nThen I washed the pan.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "note": "Denied longing; do not assign the denied label."
  },
  {
    "id": "sen-neg-15",
    "category": "sentiment-negated",
    "week": 36,
    "day": 0,
    "body": "Wrote this after dinner.\n\nI'm not glad. I'm performing glad for the room.\n\nThen I washed the pan.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "note": "Denied joy; do not assign the denied label."
  },
  {
    "id": "sen-neg-16",
    "category": "sentiment-negated",
    "week": 36,
    "day": 1,
    "body": "Wrote this after dinner.\n\nI'm not scared of the scan. I'm angry they made us wait this long.\n\nThen I washed the pan.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    },
    "note": "Denied fear; do not assign the denied label."
  },
  {
    "id": "sen-oth-01",
    "category": "sentiment-other",
    "week": 36,
    "day": 2,
    "body": "After the visit.\n\nShe was furious. I just sat there and let her have the room.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-02",
    "category": "sentiment-other",
    "week": 36,
    "day": 3,
    "body": "After the visit.\n\nHe said he felt so happy he could burst. I nodded. I felt nothing in particular.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-03",
    "category": "sentiment-other",
    "week": 36,
    "day": 4,
    "body": "After the visit.\n\nAda was scared of the dark again. I sat on the floor until her breathing slowed. I was steady.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-oth-04",
    "category": "sentiment-other",
    "week": 36,
    "day": 5,
    "body": "After the visit.\n\nDan is grieving his brother. I listened. I did not borrow it.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-05",
    "category": "sentiment-other",
    "week": 36,
    "day": 6,
    "body": "After the visit.\n\nThe pastor talked about joy like it was a product. I took notes. I felt flat.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-06",
    "category": "sentiment-other",
    "week": 37,
    "day": 0,
    "body": "After the visit.\n\nNaomi sounded hopeful on the phone. I was glad for her and also strangely empty.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-oth-07",
    "category": "sentiment-other",
    "week": 37,
    "day": 1,
    "body": "After the visit.\n\nThey were so grateful it made the room bright. I smiled. I was elsewhere.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-08",
    "category": "sentiment-other",
    "week": 37,
    "day": 2,
    "body": "After the visit.\n\nShe is ashamed of the grade. I told her the grade is not her name. I meant it calmly.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-oth-09",
    "category": "sentiment-other",
    "week": 37,
    "day": 3,
    "body": "After the visit.\n\nHe was stressed about money. I heard him. My own chest stayed quiet.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-10",
    "category": "sentiment-other",
    "week": 37,
    "day": 4,
    "body": "After the visit.\n\nThe kids were giddy. The house rang with it. I watched from the doorway, unmoved.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-11",
    "category": "sentiment-other",
    "week": 37,
    "day": 5,
    "body": "After the visit.\n\nA quoted line in the book: \"I was angry for years.\" It is not my sentence.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-12",
    "category": "sentiment-other",
    "week": 37,
    "day": 6,
    "body": "After the visit.\n\n\"I am so afraid,\" she wrote. I read it twice. I felt tenderness, not fear.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-oth-13",
    "category": "sentiment-other",
    "week": 38,
    "day": 0,
    "body": "After the visit.\n\nMy colleague is exhausted. I covered the shift. I had energy enough.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-14",
    "category": "sentiment-other",
    "week": 38,
    "day": 1,
    "body": "After the visit.\n\nThey announced it with hope in their voices. I clapped. Inside I was still.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-15",
    "category": "sentiment-other",
    "week": 38,
    "day": 2,
    "body": "After the visit.\n\nHe misses his dad out loud every Sunday. I hold the silence. That is my part.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-oth-16",
    "category": "sentiment-other",
    "week": 38,
    "day": 3,
    "body": "After the visit.\n\nShe said she felt peace wash over her. I believed her. I did not feel it.\n\nI locked the door and turned off the porch light.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    }
  },
  {
    "id": "sen-mix-01",
    "category": "sentiment-mixed",
    "week": 38,
    "day": 4,
    "body": "Two things at once, which is most days.\n\nI was grateful she called and also angry she waited until midnight.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "gratitude",
        "anger"
      ]
    }
  },
  {
    "id": "sen-mix-02",
    "category": "sentiment-mixed",
    "week": 38,
    "day": 5,
    "body": "Two things at once, which is most days.\n\nI felt hopeful about the scan and afraid of the waiting.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "hope",
        "fear"
      ]
    }
  },
  {
    "id": "sen-mix-03",
    "category": "sentiment-mixed",
    "week": 38,
    "day": 6,
    "body": "Two things at once, which is most days.\n\nI love them and I am so tired of being the strong one.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "love",
        "weariness"
      ]
    }
  },
  {
    "id": "sen-mix-04",
    "category": "sentiment-mixed",
    "week": 39,
    "day": 0,
    "body": "Two things at once, which is most days.\n\nI felt joy when she walked in and grief that he never will again.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "joy",
        "grief"
      ]
    }
  },
  {
    "id": "sen-mix-05",
    "category": "sentiment-mixed",
    "week": 39,
    "day": 1,
    "body": "Two things at once, which is most days.\n\nI am ashamed of the outburst and also still furious.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame",
        "anger"
      ]
    }
  },
  {
    "id": "sen-mix-06",
    "category": "sentiment-mixed",
    "week": 39,
    "day": 2,
    "body": "Two things at once, which is most days.\n\nI felt peace in the kitchen and stress the second I opened mail.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "peace",
        "stress"
      ]
    }
  },
  {
    "id": "sen-mix-07",
    "category": "sentiment-mixed",
    "week": 39,
    "day": 3,
    "body": "Two things at once, which is most days.\n\nI miss her and I am glad she left. Both are true.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing",
        "joy"
      ]
    }
  },
  {
    "id": "sen-mix-08",
    "category": "sentiment-mixed",
    "week": 39,
    "day": 4,
    "body": "Two things at once, which is most days.\n\nI was confused by the news and strangely hopeful anyway.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "confusion",
        "hope"
      ]
    }
  },
  {
    "id": "sen-mix-09",
    "category": "sentiment-mixed",
    "week": 39,
    "day": 5,
    "body": "Two things at once, which is most days.\n\nI felt sad about the job and grateful they told me in person.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "sadness",
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-mix-10",
    "category": "sentiment-mixed",
    "week": 39,
    "day": 6,
    "body": "Two things at once, which is most days.\n\nI am weary and I still felt a flicker of love when he apologized badly.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "weariness",
        "love"
      ]
    }
  },
  {
    "id": "sen-mix-11",
    "category": "sentiment-mixed",
    "week": 40,
    "day": 0,
    "body": "Two things at once, which is most days.\n\nI was scared and then, briefly, at rest in the same hour.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "fear",
        "peace"
      ]
    }
  },
  {
    "id": "sen-mix-12",
    "category": "sentiment-mixed",
    "week": 40,
    "day": 1,
    "body": "Two things at once, which is most days.\n\nI felt stressed about money and tender toward the kids anyway.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "stress",
        "love"
      ]
    }
  },
  {
    "id": "sen-mix-13",
    "category": "sentiment-mixed",
    "week": 40,
    "day": 2,
    "body": "Two things at once, which is most days.\n\nI was down and also thankful for soup. The soup did not fix the down.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "sadness",
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-mix-14",
    "category": "sentiment-mixed",
    "week": 40,
    "day": 3,
    "body": "Two things at once, which is most days.\n\nI felt delight at the drawing and shame that I almost snapped first.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "joy",
        "shame"
      ]
    }
  },
  {
    "id": "sen-mix-15",
    "category": "sentiment-mixed",
    "week": 40,
    "day": 4,
    "body": "Two things at once, which is most days.\n\nI am longing for home and angry at the version of home I keep inventing.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing",
        "anger"
      ]
    }
  },
  {
    "id": "sen-mix-16",
    "category": "sentiment-mixed",
    "week": 40,
    "day": 5,
    "body": "Two things at once, which is most days.\n\nI felt exhausted and hopeful that tomorrow is shorter.\n\nI wrote that down so I would not tidy it later.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "weariness",
        "hope"
      ]
    }
  },
  {
    "id": "sen-abs-01",
    "category": "sentiment-absent",
    "week": 40,
    "day": 6,
    "body": "Bought milk. The price is up again. Walked home.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-02",
    "category": "sentiment-absent",
    "week": 41,
    "day": 0,
    "body": "The meeting ran long. I took notes. Nobody decided anything.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-03",
    "category": "sentiment-absent",
    "week": 41,
    "day": 1,
    "body": "Painted the spare room a colour I will probably regret. It is dry now.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-04",
    "category": "sentiment-absent",
    "week": 41,
    "day": 2,
    "body": "List: stamps, printer paper, the form for school. I did the first two.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-05",
    "category": "sentiment-absent",
    "week": 41,
    "day": 3,
    "body": "Bus was late. I stood under the awning and watched a dog ignore its person.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-06",
    "category": "sentiment-absent",
    "week": 41,
    "day": 4,
    "body": "Finished the novel. The ending was neat. I put it back on the shelf.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-07",
    "category": "sentiment-absent",
    "week": 41,
    "day": 5,
    "body": "Changed the washer on the tap. It stopped dripping. That is the update.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-08",
    "category": "sentiment-absent",
    "week": 41,
    "day": 6,
    "body": "Calendar says Thursday is free. I blocked it for the dentist.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-09",
    "category": "sentiment-absent",
    "week": 42,
    "day": 0,
    "body": "The plant on the sill is still alive. I watered it. End of report.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-10",
    "category": "sentiment-absent",
    "week": 42,
    "day": 1,
    "body": "Sorted the recycling. A jar lid I have been keeping for no reason went out.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-11",
    "category": "sentiment-absent",
    "week": 42,
    "day": 2,
    "body": "Measured the window for blinds. Wrote the numbers on an envelope.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-12",
    "category": "sentiment-absent",
    "week": 42,
    "day": 3,
    "body": "The neighbour's bin was still out. I pulled it in. They can return the favour or not.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-13",
    "category": "sentiment-absent",
    "week": 42,
    "day": 4,
    "body": "Oil change at 14:20. The waiting room magazine was from last spring.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-14",
    "category": "sentiment-absent",
    "week": 42,
    "day": 5,
    "body": "I copied the recipe onto a card and put the card in the box.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-15",
    "category": "sentiment-absent",
    "week": 42,
    "day": 6,
    "body": "Walked the long way because the short way is torn up. Got home at 18:10.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-abs-16",
    "category": "sentiment-absent",
    "week": 43,
    "day": 0,
    "body": "The drawer still sticks. I have not sanded it. I am recording that I noticed.",
    "sentiment": {
      "present": false,
      "valence": "mixed",
      "emotions": []
    },
    "passages": []
  },
  {
    "id": "sen-exp-joy-x01",
    "category": "sentiment-explicit",
    "week": 43,
    "day": 1,
    "body": "I felt happy in the cheap seats and did not need a better view. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-exp-joy-x02",
    "category": "sentiment-explicit",
    "week": 43,
    "day": 2,
    "body": "I was glad for a small win at work. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "joy"
      ]
    }
  },
  {
    "id": "sen-exp-peace-x01",
    "category": "sentiment-explicit",
    "week": 43,
    "day": 3,
    "body": "I felt calm enough to leave the argument unfinished. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-exp-peace-x02",
    "category": "sentiment-explicit",
    "week": 43,
    "day": 4,
    "body": "I was at rest on the late train. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "peace"
      ]
    }
  },
  {
    "id": "sen-exp-gratitude-x01",
    "category": "sentiment-explicit",
    "week": 43,
    "day": 5,
    "body": "I felt thankful for a stranger holding the door. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-exp-gratitude-x02",
    "category": "sentiment-explicit",
    "week": 43,
    "day": 6,
    "body": "I was grateful the rain waited until I got in. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "gratitude"
      ]
    }
  },
  {
    "id": "sen-exp-hope-x01",
    "category": "sentiment-explicit",
    "week": 44,
    "day": 0,
    "body": "I felt hopeful enough to plant the bulbs. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "sen-exp-hope-x02",
    "category": "sentiment-explicit",
    "week": 44,
    "day": 1,
    "body": "I was expectant about a letter that may never come. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "hope"
      ]
    }
  },
  {
    "id": "sen-exp-love-x01",
    "category": "sentiment-explicit",
    "week": 44,
    "day": 2,
    "body": "I felt love for him in the middle of a boring errand. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-exp-love-x02",
    "category": "sentiment-explicit",
    "week": 44,
    "day": 3,
    "body": "I was tender toward her when she was wrong. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "positive",
      "emotions": [
        "love"
      ]
    }
  },
  {
    "id": "sen-exp-longing-x01",
    "category": "sentiment-explicit",
    "week": 44,
    "day": 4,
    "body": "I longed for a city I have not seen in ten years. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "sen-exp-longing-x02",
    "category": "sentiment-explicit",
    "week": 44,
    "day": 5,
    "body": "I missed a voice I cannot call back. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "mixed",
      "emotions": [
        "longing"
      ]
    }
  },
  {
    "id": "sen-exp-sadness-x01",
    "category": "sentiment-explicit",
    "week": 44,
    "day": 6,
    "body": "I felt sad at the empty chair and did not move it. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "sadness"
      ]
    }
  },
  {
    "id": "sen-exp-sadness-x02",
    "category": "sentiment-explicit",
    "week": 45,
    "day": 0,
    "body": "I was sorrowful in a way that needed no story. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "sadness"
      ]
    }
  },
  {
    "id": "sen-exp-grief-x01",
    "category": "sentiment-explicit",
    "week": 45,
    "day": 1,
    "body": "I grieved him in the hardware aisle, of all places. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "grief"
      ]
    }
  },
  {
    "id": "sen-exp-grief-x02",
    "category": "sentiment-explicit",
    "week": 45,
    "day": 2,
    "body": "I felt the mourning again when a song came on in a shop. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "grief"
      ]
    }
  },
  {
    "id": "sen-exp-fear-x01",
    "category": "sentiment-explicit",
    "week": 45,
    "day": 3,
    "body": "I felt afraid of the quiet after they left. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "sen-exp-fear-x02",
    "category": "sentiment-explicit",
    "week": 45,
    "day": 4,
    "body": "I was scared the number would be the hospital again. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "fear"
      ]
    }
  },
  {
    "id": "sen-exp-anger-x01",
    "category": "sentiment-explicit",
    "week": 45,
    "day": 5,
    "body": "I felt angry at the small lie and the big one underneath. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    }
  },
  {
    "id": "sen-exp-anger-x02",
    "category": "sentiment-explicit",
    "week": 45,
    "day": 6,
    "body": "I was furious in the car and then I was just driving. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "anger"
      ]
    }
  },
  {
    "id": "sen-exp-shame-x01",
    "category": "sentiment-explicit",
    "week": 46,
    "day": 0,
    "body": "I felt ashamed of the shortcut I took with the truth. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "sen-exp-shame-x02",
    "category": "sentiment-explicit",
    "week": 46,
    "day": 1,
    "body": "I was ashamed and I did not explain it away. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "shame"
      ]
    }
  },
  {
    "id": "sen-exp-confusion-x01",
    "category": "sentiment-explicit",
    "week": 46,
    "day": 2,
    "body": "I felt confused by my own yes. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "sen-exp-confusion-x02",
    "category": "sentiment-explicit",
    "week": 46,
    "day": 3,
    "body": "I was lost about what I had agreed to. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "confusion"
      ]
    }
  },
  {
    "id": "sen-exp-weariness-x01",
    "category": "sentiment-explicit",
    "week": 46,
    "day": 4,
    "body": "I felt tired of my own competence. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "sen-exp-weariness-x02",
    "category": "sentiment-explicit",
    "week": 46,
    "day": 5,
    "body": "I was exhausted by a kindness I keep performing. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "weariness"
      ]
    }
  },
  {
    "id": "sen-exp-stress-x01",
    "category": "sentiment-explicit",
    "week": 46,
    "day": 6,
    "body": "I felt stressed by a calendar that is only mine. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "sen-exp-stress-x02",
    "category": "sentiment-explicit",
    "week": 47,
    "day": 0,
    "body": "I was tense waiting for a number I already knew. Then I put the kettle on.",
    "sentiment": {
      "present": true,
      "valence": "negative",
      "emotions": [
        "stress"
      ]
    }
  },
  {
    "id": "sen-exp-peace-x03",
    "category": "sentiment-explicit",
    "week": 47,
    "day": 1,
    "body": "I felt calm on the late bus and did not fill the silence. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "positive", "emotions": ["peace"] }
  },
  {
    "id": "sen-exp-peace-x04",
    "category": "sentiment-explicit",
    "week": 47,
    "day": 2,
    "body": "I was at rest after I told the truth and sat down. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "positive", "emotions": ["peace"] }
  },
  {
    "id": "sen-exp-gratitude-x03",
    "category": "sentiment-explicit",
    "week": 47,
    "day": 3,
    "body": "I felt thankful for a boring, uneventful scan. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "positive", "emotions": ["gratitude"] }
  },
  {
    "id": "sen-exp-longing-x03",
    "category": "sentiment-explicit",
    "week": 47,
    "day": 4,
    "body": "I longed for a Sunday that still had everyone in it. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "mixed", "emotions": ["longing"] }
  },
  {
    "id": "sen-exp-longing-x04",
    "category": "sentiment-explicit",
    "week": 47,
    "day": 5,
    "body": "I missed a kitchen that smelled like someone else cooking. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "mixed", "emotions": ["longing"] }
  },
  {
    "id": "sen-exp-sadness-x03",
    "category": "sentiment-explicit",
    "week": 47,
    "day": 6,
    "body": "I felt sad putting the third chair back. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "negative", "emotions": ["sadness"] }
  },
  {
    "id": "sen-exp-grief-x03",
    "category": "sentiment-explicit",
    "week": 48,
    "day": 0,
    "body": "I grieved him in the jumper that still smells like rain. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "negative", "emotions": ["grief"] }
  },
  {
    "id": "sen-exp-grief-x04",
    "category": "sentiment-explicit",
    "week": 48,
    "day": 1,
    "body": "I felt the mourning again when I passed his chair. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "negative", "emotions": ["grief"] }
  },
  {
    "id": "sen-exp-grief-x05",
    "category": "sentiment-explicit",
    "week": 48,
    "day": 2,
    "body": "I am still mourning the version of the house that had his keys. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "negative", "emotions": ["grief"] }
  },
  {
    "id": "sen-exp-grief-x06",
    "category": "sentiment-explicit",
    "week": 48,
    "day": 3,
    "body": "Grief sat in the passenger seat on the way home. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "negative", "emotions": ["grief"] }
  },
  {
    "id": "sen-exp-grief-x07",
    "category": "sentiment-explicit",
    "week": 48,
    "day": 4,
    "body": "I mourned in the aisle where we used to argue about cereal. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "negative", "emotions": ["grief"] }
  },
  {
    "id": "sen-exp-confusion-x03",
    "category": "sentiment-explicit",
    "week": 48,
    "day": 5,
    "body": "I felt confused by a yes I no longer recognise as mine. Then I put the kettle on.",
    "sentiment": { "present": true, "valence": "negative", "emotions": ["confusion"] }
  },
]
