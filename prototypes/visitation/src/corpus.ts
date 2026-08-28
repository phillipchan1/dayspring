/**
 * Fictional journal. Not a real person.
 *
 * Anna, four years. Extended from prototypes/recall/src/corpus.ts on purpose —
 * same woman, same voice — so a follow-up call can walk both prototypes without
 * a discontinuity.
 *
 * Two shapes in here are load-bearing and must not be tidied away:
 *
 *   1. A THIN STRETCH — Mar 2024 to Aug 2024, three entries, almost nothing
 *      marked. Every scene has to stay honest across it. A prototype that only
 *      works on a dense corpus is a demo of an archive we do not have.
 *   2. A BURST — five entries in thirty-one days, Sep–Oct 2024, after four quiet
 *      months. That is the shape an episode has, and it is arithmetic.
 *
 * Every marking quote is a verbatim substring of the paragraph it sits beside.
 * validateMarkings() enforces it, because that is the product's own rule.
 */

export type Capture = 'typed' | 'car'

export type Hue = 'amber' | 'rose' | 'sage' | 'sky' | 'lilac'

/**
 * Every way a writer puts their own touch on their own words.
 *
 * Declared — you named the act. Touch — you emphasised the words.
 * The split is not a hierarchy: a highlight is as much a marking as a prayer.
 */
export type MarkingKind =
  | 'scripture'
  | 'sense'
  | 'prayer'
  | 'story'
  | 'learned'
  | 'desire'
  | 'mark'
  | 'highlight'
  | 'underline'
  | 'quote'

export type Marking = {
  kind: MarkingKind
  /** Verbatim. A substring of paragraphs[para]. The record of truth. */
  quote: string
  /** Which paragraph it sits beside — the margin needs an anchor. */
  para: number
  hue?: Hue
  /** Scripture only. The citation, never the verse text. */
  ref?: string
  /**
   * In pencil — the app put this here, and it is not a marking yet.
   *
   * A proposed marking is deliberately NOT the same object as one the writer
   * made. D-016 rejected model-inferred significance outright; what keeps this
   * on the right side of it is that pencil is not a claim. Until it is kept it
   * carries no weight, appears in no count, and reaches no other surface.
   */
  proposed?: boolean
}

export type Entry = {
  id: string
  date: string
  capture?: Capture
  /** One thought per paragraph. Paragraphs are the lines. */
  paragraphs: string[]
  markings?: Marking[]
}

export type Subject = {
  key: string
  label: string
  terms: string[]
  kind: 'person' | 'matter'
}

export type Line = {
  entryId: string
  date: string
  text: string
  capture?: Capture
  index: number
}

/** Ordered by when each first appeared in the journal. Never by count. */
export const SUBJECTS: Subject[] = [
  { key: 'mom', label: 'Mom', terms: ['mom', 'mother', 'grandma'], kind: 'person' },
  { key: 'leo', label: 'Leo', terms: ['leo'], kind: 'person' },
  { key: 'mira', label: 'Mira', terms: ['mira'], kind: 'person' },
  { key: 'david', label: 'David', terms: ['david'], kind: 'person' },
  { key: 'newthing', label: 'a new thing', terms: ['isaiah', 'new thing'], kind: 'matter' },
]

export const ENTRIES: Entry[] = [
  // ── 2023 · she begins ────────────────────────────────────────────────────
  {
    id: 'e-2023-02-05',
    date: '2023-02-05',
    paragraphs: [
      "First page. I bought this because Sarah said writing helps and I have run out of other ideas.",
      "I do not know what to put down. It is Sunday, the dishwasher is running, and everyone else is asleep.",
      "I will try again tomorrow. That is the whole entry.",
      'Is this the kind of thing that works, or the kind of thing people say works?',
    ],
  },
  {
    id: 'e-2023-03-19',
    date: '2023-03-19',
    paragraphs: [
      "Conference with Leo's teacher. She used the word bright twice and the word distracted four times, and I counted.",
      "He is seven. I keep having to remind myself that he is seven.",
      "David thinks I take it harder than Leo does, which is probably the truest thing anyone said today.",
      'Am I making this harder for him than it already is?',
    ],
    markings: [{ kind: 'highlight', hue: 'amber', para: 1, quote: 'I keep having to remind myself that he is seven' }],
  },
  {
    id: 'e-2023-05-07',
    date: '2023-05-07',
    paragraphs: [
      "Mom told me the story about the neighbor's dog twice in one phone call.",
      "The second time she told it the same way, with the same pause before the punchline, and I laughed in the same place.",
      "I am probably making something out of nothing.",
    ],
    markings: [
      {
        kind: 'mark',
        para: 1,
        quote: 'The second time she told it the same way, with the same pause before the punchline, and I laughed in the same place.',
      },
    ],
  },
  {
    id: 'e-2023-06-24',
    date: '2023-06-24',
    paragraphs: [
      "David's project went long again. He got home after the kids and ate standing up at the counter.",
      "I am not angry. I am something with fewer letters than angry and it lasts longer.",
      "Mira drew all four of us and put the dog we do not have in the middle.",
    ],
    markings: [
      { kind: 'highlight', hue: 'rose', para: 1, quote: 'something with fewer letters than angry and it lasts longer' },
    ],
  },
  {
    id: 'e-2023-08-13',
    date: '2023-08-13',
    paragraphs: [
      "Mira starts kindergarten in three weeks and has started asking what happens if nobody sits with her.",
      "I told her I would pack two of everything so she would have something to offer. She thought about that for a long time and then said okay.",
      "Bringing her to God tonight because I cannot go in with her.",
      'What do I pack for the part I cannot walk into with her?',
    ],
    markings: [
      { kind: 'prayer', para: 2, quote: 'Bringing her to God tonight because I cannot go in with her.' },
    ],
  },
  {
    id: 'e-2023-09-30',
    date: '2023-09-30',
    paragraphs: [
      "Church. The reading was Psalm 121 and I have heard it a hundred times and today the first line stopped me.",
      "I lift up my eyes. That is all I got. I did not hear the rest of the sermon.",
      "I wrote the reference on the back of my hand like a teenager so I would not lose it.",
    ],
    markings: [
      { kind: 'scripture', ref: 'Psalm 121:1', para: 0, quote: 'The reading was Psalm 121 and I have heard it a hundred times and today the first line stopped me.' },
      { kind: 'underline', para: 1, quote: 'I lift up my eyes. That is all I got.' },
    ],
  },
  {
    id: 'e-2023-11-05',
    date: '2023-11-05',
    paragraphs: [
      "Mom forgot the pie. Not forgot to make it — forgot that she had made it, and found it in the oven cold on Sunday.",
      "She laughed. Everyone laughed. I laughed a beat late.",
      "Leo asked me in the car why I was quiet and I said I was thinking about pie, which was not a lie exactly.",
      'How much of this is she going to remember?',
    ],
    markings: [
      { kind: 'mark', para: 0, quote: 'forgot that she had made it, and found it in the oven cold on Sunday' },
      { kind: 'highlight', hue: 'sky', para: 1, quote: 'I laughed a beat late' },
    ],
  },
  {
    id: 'e-2023-12-18',
    date: '2023-12-18',
    paragraphs: [
      "Almost a year of this. I went back and read February and did not recognize the person who wrote it, which I think is good.",
      "What I have learned: I write when things are hard and I forget to write when things are fine, so the record is lopsided and I should not read it as the whole year.",
      'If the record is lopsided, whose year have I actually been reading?',
    ],
    markings: [
      {
        kind: 'learned',
        para: 1,
        quote: 'I write when things are hard and I forget to write when things are fine, so the record is lopsided',
      },
    ],
  },

  // ── 2024 · the thin stretch, then the burst ──────────────────────────────
  {
    id: 'e-2024-01-14',
    date: '2024-01-14',
    paragraphs: [
      "New year. I want to be someone who prays for her family on purpose instead of in emergencies.",
      "That is the whole resolution. I am not making a chart for it.",
      'Am I making it harder by deciding in advance that it will be harder?',
    ],
    markings: [
      { kind: 'desire', para: 0, quote: 'I want to be someone who prays for her family on purpose instead of in emergencies.' },
    ],
  },
  {
    id: 'e-2024-03-02',
    date: '2024-03-02',
    paragraphs: ["Tired. Nothing to say. Writing it down so the page is not empty.", 'Where did the spring go?'],
  },
  {
    id: 'e-2024-06-11',
    date: '2024-06-11',
    paragraphs: [
      "I have not written since March.",
      "Nothing happened. That is not true — a whole spring happened. I just did not sit down for any of it.",
      'Is anyone hearing any of this, or am I talking to the ceiling?',
    ],
    markings: [{ kind: 'sense', para: 1, quote: 'I just did not sit down for any of it.' }],
  },
  {
    id: 'e-2024-08-25',
    date: '2024-08-25',
    paragraphs: [
      "End of summer. The kids are brown and feral and I am ready for a schedule.",
      "Mom has an appointment in September that David keeps calling routine in a voice that is not routine.",
    ],
  },
  {
    id: 'e-2024-09-21',
    date: '2024-09-21',
    paragraphs: [
      "They used a word about Mom today. Not the worst word, an early word, but a word.",
      "I drove home the long way and I do not remember any of the drive.",
      "I keep thinking about the pie.",
    ],
    markings: [
      { kind: 'mark', para: 0, quote: 'Not the worst word, an early word, but a word.' },
      { kind: 'highlight', hue: 'rose', para: 2, quote: 'I keep thinking about the pie' },
    ],
  },
  {
    id: 'e-2024-09-27',
    date: '2024-09-27',
    paragraphs: [
      "Called Mom to check and she was completely herself, sharp, asking about Leo's reading.",
      "So now I am a person who is relieved and suspicious at the same time.",
      "Bringing her before God. I do not have a request. I just keep saying her name.",
    ],
    markings: [
      { kind: 'prayer', para: 2, quote: 'I do not have a request. I just keep saying her name.' },
    ],
  },
  {
    id: 'e-2024-10-03',
    date: '2024-10-03',
    paragraphs: [
      "Told David I am scared about Mom and he did not say it will be fine, which I noticed and was grateful for.",
      "He said we will go together, and then he actually put the dates in the calendar, which for him is a love language.",
      'Is it him, or am I the one making it harder?',
    ],
    markings: [
      { kind: 'story', para: 0, quote: 'Told David I am scared about Mom and he did not say it will be fine' },
      { kind: 'underline', para: 1, quote: 'we will go together' },
    ],
  },
  {
    id: 'e-2024-10-09',
    date: '2024-10-09',
    paragraphs: [
      "Lamentations came up in the group tonight — the mercies are new every morning line — and I have always found it a little easy.",
      "Tonight it was not easy. Tonight it was the only sentence that fit.",
      "I have the sense that I am being handed something to carry rather than something to fix. I do not know what to do with that yet.",
    ],
    markings: [
      { kind: 'scripture', ref: 'Lamentations 3:22-23', para: 0, quote: 'Lamentations came up in the group tonight' },
      { kind: 'highlight', hue: 'amber', para: 1, quote: 'Tonight it was the only sentence that fit' },
      { kind: 'sense', para: 2, quote: 'I am being handed something to carry rather than something to fix' },
    ],
  },
  {
    id: 'e-2024-10-22',
    date: '2024-10-22',
    paragraphs: [
      "Took the kids to see her. She made Leo show her the reading book and she was patient with him in a way I am not.",
      "Mira sat on the arm of the chair and narrated. Mom let her.",
      "On the way home Leo said Grandma is good at listening and I had to stop at a light and breathe.",
    ],
    markings: [
      { kind: 'story', para: 2, quote: 'Leo said Grandma is good at listening and I had to stop at a light and breathe' },
      { kind: 'mark', para: 0, quote: 'she was patient with him in a way I am not' },
    ],
  },
  {
    id: 'e-2024-12-01',
    date: '2024-12-01',
    paragraphs: [
      "Quieter month. The word from September has become a thing we live with instead of a thing that happened.",
      "What I have learned: the fear was worse in the week before we knew than it has been in any week since.",
      'When do I stop making it harder in advance?',
    ],
    markings: [
      { kind: 'learned', para: 1, quote: 'the fear was worse in the week before we knew than it has been in any week since' },
    ],
  },

  // ── 2025 ─────────────────────────────────────────────────────────────────
  {
    id: 'e-2025-01-08',
    date: '2025-01-08',
    paragraphs: [
      'First quiet morning of the year. The house is still and I am trying to remember how to sit.',
      'I want to be praying about my marriage this year. Not fixing David. Just bringing him.',
      'I keep making lists instead of actually talking to God about it.',
      'How much will she remember of this year?',
    ],
    markings: [
      { kind: 'desire', para: 1, quote: 'I want to be praying about my marriage this year.' },
      { kind: 'prayer', para: 1, quote: 'Not fixing David. Just bringing him.' },
      { kind: 'highlight', hue: 'sage', para: 2, quote: 'I keep making lists instead of actually talking to God about it' },
      { kind: 'sense', para: 2, quote: 'instead of actually talking to God about it' },
    ],
  },
  {
    id: 'e-2025-01-22',
    date: '2025-01-22',
    paragraphs: [
      'Leo had practice and then a meltdown in the gym lobby over a water bottle.',
      'Mira watched from the bench with that little folded-up face she gets when someone else is loud.',
      'I was short with both of them in the car and then sorry the whole way home.',
    ],
    markings: [
      { kind: 'highlight', hue: 'lilac', para: 1, quote: 'that little folded-up face she gets when someone else is loud' },
    ],
  },
  {
    id: 'e-2025-02-03',
    date: '2025-02-03',
    paragraphs: [
      'Long day. I am writing this because if I don\'t I will just keep moving.',
      'Work ran late. David had already fed them. The kitchen was a wreck and I was grateful and irritated at the same time, which is a stupid combination.',
      'Leo wanted me to watch a video of a trick he learned. I said in a minute and then it was bedtime.',
      'Mira asked if we could read the one about the fox again. We did.',
      'I still have not unpacked the bag from the weekend.',
      'Mom called and told me the same story about the neighbor\'s dog, twice, and I did not know whether to laugh or to put my head down on the table.',
      'Then I paid the electric bill and wiped the counters and it was 10:40.',
    ],
    markings: [
      { kind: 'mark', para: 5, quote: 'told me the same story about the neighbor\'s dog, twice' },
    ],
  },
  {
    id: 'e-2025-02-18',
    date: '2025-02-18',
    paragraphs: [
      'Church this morning. I was half-listening until Isaiah 43:19 — behold I am doing a new thing.',
      'I wrote it in the bulletin and then lost the bulletin in the van under Mira\'s seat.',
      'I don\'t know what the new thing is. I just know I have been asking for one.',
      'What if the new thing is not an event?',
    ],
    markings: [
      { kind: 'scripture', ref: 'Isaiah 43:19', para: 0, quote: 'I was half-listening until Isaiah 43:19 — behold I am doing a new thing.' },
      { kind: 'underline', para: 2, quote: 'I just know I have been asking for one' },
    ],
  },
  {
    id: 'e-2025-03-04',
    date: '2025-03-04',
    paragraphs: [
      'I sat down to dump and now I cannot stop.',
      'Leo\'s coach emailed about playing time and I drafted three replies and sent none of them.',
      'David was short at breakfast. I was shorter. We recovered by dinner the way we do, without actually saying the thing.',
      'I keep thinking if I just get through this month the house will feel like a house again.',
      'Grocery list: milk, the bread Mira will actually eat, more coffee, something green so I can pretend.',
      'Mom asked what year it was and laughed like it was a joke, and I laughed too, and then I sat in the driveway for a long time.',
      'Mira\'s left shoe is still missing. Leo says he didn\'t take it. I believe him and also I don\'t.',
      'I don\'t know why I wrote all of this. It is a lot of words to say I am tired.',
    ],
    markings: [
      { kind: 'mark', para: 5, quote: 'then I sat in the driveway for a long time' },
    ],
  },
  {
    id: 'e-2025-03-21',
    date: '2025-03-21',
    paragraphs: [
      'We argued about money. Not even a lot of money. The tone of it.',
      'After the kids were down I told David I was scared we were becoming roommates who share a calendar.',
      'He sat on the edge of the bed and didn\'t defend himself, which was either grace or exhaustion.',
      'I prayed for my marriage in the dark like I used to, before I had a system for it.',
      'How long have we been roommates who share a calendar?',
    ],
    markings: [
      { kind: 'highlight', hue: 'rose', para: 1, quote: 'roommates who share a calendar' },
      { kind: 'prayer', para: 3, quote: 'I prayed for my marriage in the dark like I used to, before I had a system for it.' },
    ],
  },
  {
    id: 'e-2025-04-09',
    date: '2025-04-09',
    paragraphs: [
      'Mira woke at 2 from a nightmare and would not tell me what it was.',
      'She just said stay, so I stayed.',
      'Leo slept through the whole thing, which felt like a small mercy and also like I was doing two different nights at once.',
      'Why is stay the only word she needed?',
    ],
    markings: [{ kind: 'highlight', hue: 'lilac', para: 1, quote: 'She just said stay, so I stayed.' }],
  },
  {
    id: 'e-2025-04-27',
    date: '2025-04-27',
    paragraphs: [
      'Drove to Mom\'s. She was in the garden with the tomatoes and she knew my name.',
      'We sat on the back step and she asked about the kids as if she had been saving the question.',
      'I did not want to leave. I left anyway, because Leo had a game.',
    ],
    markings: [
      { kind: 'mark', para: 0, quote: 'She was in the garden with the tomatoes and she knew my name.' },
      { kind: 'story', para: 0, quote: 'she knew my name' },
      { kind: 'story', para: 1, quote: 'she asked about the kids as if she had been saving the question' },
    ],
  },
  {
    id: 'e-2025-05-14',
    date: '2025-05-14',
    paragraphs: [
      'The same verse found me again. Isaiah. A new thing. I was not even looking for it — it was in a song Mira was humming.',
      'I don\'t trust how much I want it to mean something.',
      'David asked why I was quiet at dinner. I said I was tired, which was true and also not the whole true.',
    ],
    markings: [
      { kind: 'scripture', ref: 'Isaiah 43:19', para: 0, quote: 'The same verse found me again. Isaiah. A new thing.' },
      { kind: 'sense', para: 1, quote: 'I don\'t trust how much I want it to mean something.' },
    ],
  },
  {
    id: 'e-2025-06-02',
    date: '2025-06-02',
    paragraphs: [
      'David took me out. No occasion. He had already asked my sister to take the kids.',
      'I cried in the car on the way home, which I hated, and he didn\'t try to fix it.',
      'I want to remember that he still knows how to do this.',
    ],
    markings: [
      { kind: 'story', para: 0, quote: 'David took me out. No occasion. He had already asked my sister to take the kids.' },
      { kind: 'underline', para: 2, quote: 'he still knows how to do this' },
      { kind: 'story', para: 1, quote: 'he didn\'t try to fix it' },
    ],
  },
  {
    id: 'e-2025-06-19',
    date: '2025-06-19',
    paragraphs: [
      'Dumping because the week was noise.',
      'Leo lost his library book. Mira bit a kid at camp and I had to have the conversation, the one where I am calm on the outside.',
      'Work wants an answer by Friday on a thing I do not want to do.',
      'I stood in the pantry eating crackers and calling it lunch.',
      'Mom did not pick up. I did not try a second time, and I am writing that down so I cannot pretend I did.',
      'David loaded the dishwasher without being asked. I noticed and did not say it.',
    ],
    markings: [
      { kind: 'mark', para: 4, quote: 'I am writing that down so I cannot pretend I did' },
    ],
  },
  {
    id: 'e-2025-07-08',
    date: '2025-07-08',
    paragraphs: [
      'Half a day alone at the library. I brought the journal on purpose.',
      'What I have been praying about the kids: that Leo would not decide he is the problem, and that Mira would come out from behind her own quiet.',
      'I think God has been kind in small ways I only see when I sit still long enough.',
      'I still don\'t like rereading the messy pages. They feel like walking back into a room I already left.',
    ],
    markings: [
      { kind: 'prayer', para: 1, quote: 'that Leo would not decide he is the problem, and that Mira would come out from behind her own quiet' },
      { kind: 'sense', para: 2, quote: 'God has been kind in small ways I only see when I sit still long enough' },
      { kind: 'highlight', hue: 'sky', para: 3, quote: 'like walking back into a room I already left' },
      { kind: 'mark', para: 0, quote: 'I brought the journal on purpose.' },
    ],
  },
  {
    id: 'e-2025-08-15',
    date: '2025-08-15',
    paragraphs: [
      'Mom is in the hospital. Not the bad kind of sentence, they said, and then they said we should come.',
      'I sat in the hallway and wrote this on my phone because I could not sit there doing nothing and I also could not pray out loud.',
      'She looked small. I hated that I thought that. I am leaving it anyway.',
      'Leo asked if Grandma was dying. I said I don\'t know, which was the first honest thing I had said all day.',
      'Does it matter how much she can remember, if I remember for her?',
    ],
    markings: [
      { kind: 'mark', para: 2, quote: 'She looked small. I hated that I thought that. I am leaving it anyway.' },
      { kind: 'sense', para: 1, quote: 'I also could not pray out loud' },
    ],
  },
  {
    id: 'e-2025-08-22',
    date: '2025-08-22',
    paragraphs: [
      "Mom is home. The discharge papers say a lot of words that mean we do not know.",
      "David drove. I sat in the back with her like a kid.",
      "Leo asked twice whether Grandma was better and I gave him two different answers.",
    ],
    markings: [
      { kind: 'mark', para: 0, quote: 'a lot of words that mean we do not know' },
      { kind: 'story', para: 1, quote: 'I sat in the back with her like a kid.' },
    ],
  },
  {
    id: 'e-2025-08-28',
    date: '2025-08-28',
    paragraphs: [
      "Sat with Mom while she napped. The house smells the same as it did when I was nine.",
      "I keep bringing her and I keep not knowing what to ask for.",
    ],
    markings: [
      { kind: 'story', para: 0, quote: 'The house smells the same as it did when I was nine.' },
      { kind: 'prayer', para: 1, quote: 'I keep bringing her and I keep not knowing what to ask for.' },
    ],
  },
  {
    id: 'e-2025-09-02',
    date: '2025-09-02',
    paragraphs: [
      'First day of school. Leo walked in without looking back. Mira held my fingers until the last possible second.',
      'The house was too quiet and I wasted it on email.',
      'David texted a picture of his coffee like we were still new.',
    ],
    markings: [
      { kind: 'highlight', hue: 'amber', para: 0, quote: 'Mira held my fingers until the last possible second' },
    ],
  },
  {
    id: 'e-2025-10-11',
    date: '2025-10-11',
    paragraphs: [
      'Marriage feels like a hallway this month. We pass. We are kind. We do not stop.',
      'I miss David in the specific way you miss someone who is still in the house.',
      'I prayed about it for four minutes and then folded laundry, which is also a kind of prayer if I am being generous, and I am not sure I should be.',
    ],
    markings: [
      { kind: 'mark', para: 1, quote: 'I miss David in the specific way you miss someone who is still in the house.' },
      { kind: 'sense', para: 2, quote: 'I prayed about it for four minutes and then folded laundry' },
      { kind: 'highlight', hue: 'rose', para: 0, quote: 'Marriage feels like a hallway this month' },
    ],
  },
  {
    id: 'e-2025-11-20',
    date: '2025-11-20',
    paragraphs: [
      'Leo\'s concert. He looked for us in the dark and found us.',
      'Mira fell asleep against David\'s arm in the second row.',
      'I thought: this is the whole thing, and I am going to forget I thought it.',
    ],
    markings: [
      { kind: 'story', para: 0, quote: 'He looked for us in the dark and found us.' },
      { kind: 'story', para: 1, quote: 'Mira fell asleep against David\'s arm in the second row.' },
      { kind: 'underline', para: 2, quote: 'this is the whole thing, and I am going to forget I thought it' },
    ],
  },
  {
    id: 'e-2025-12-24',
    date: '2025-12-24',
    paragraphs: [
      'Christmas Eve. The kids put out the plates for cookies like it still works.',
      'David read the Luke passage and his voice went quiet at the shepherds, the way it does every year.',
      'I was glad for a night that asked so little of me.',
      'What do I do with a night that asks nothing of me?',
    ],
    markings: [
      { kind: 'scripture', ref: 'Luke 2:8-14', para: 1, quote: 'David read the Luke passage and his voice went quiet at the shepherds' },
    ],
  },

  // ── 2026 ─────────────────────────────────────────────────────────────────
  {
    id: 'e-2026-01-06',
    date: '2026-01-06',
    paragraphs: [
      'Another January. I wrote last year that I wanted to pray about my marriage, and I did, in fits.',
      'I am not making a plan this time. I am just going to keep bringing David when I sit down.',
      'Are we still roommates who share a calendar, or did that pass?',
    ],
    markings: [
      { kind: 'prayer', para: 1, quote: 'I am just going to keep bringing David when I sit down.' },
      { kind: 'learned', para: 0, quote: 'I wrote last year that I wanted to pray about my marriage, and I did, in fits' },
    ],
  },
  {
    id: 'e-2026-02-14',
    date: '2026-02-14',
    paragraphs: [
      'David left a note on the counter. Not a production. Just my name and a line from a song we used to know.',
      'The kids made him a card with too much glue. He put it on the fridge like it was serious.',
    ],
    markings: [
      { kind: 'story', para: 0, quote: 'David left a note on the counter. Not a production. Just my name and a line from a song we used to know.' },
      { kind: 'story', para: 0, quote: 'Just my name and a line from a song we used to know.' },
      { kind: 'highlight', hue: 'amber', para: 1, quote: 'He put it on the fridge like it was serious.' },
    ],
  },
  {
    id: 'e-2026-03-01',
    date: '2026-03-01',
    paragraphs: [
      'Leo said he thinks he is bad at friends. I sat on the floor of his room and did not rush him.',
      'Mira practiced writing her name with the R backwards and was proud anyway.',
      'Who told him that friends are a thing you are good at?',
    ],
    markings: [
      { kind: 'mark', para: 0, quote: 'Leo said he thinks he is bad at friends.' },
      { kind: 'learned', para: 0, quote: 'I sat on the floor of his room and did not rush him' },
      { kind: 'highlight', hue: 'sage', para: 1, quote: 'was proud anyway' },
    ],
  },
  {
    id: 'e-2026-04-18',
    date: '2026-04-18',
    paragraphs: [
      'Mira did not want to go to the birthday party. She hid in the coat closet.',
      'I sat outside the door and talked to the coats until she laughed, which felt like cheating and also like the only thing that worked.',
    ],
    markings: [
      { kind: 'story', para: 1, quote: 'I sat outside the door and talked to the coats until she laughed' },
    ],
  },
  {
    id: 'e-2026-05-09',
    date: '2026-05-09',
    paragraphs: [
      'I went to see Mom. She is home. She is smaller. She knew me after a minute.',
      'We looked at old photographs and she told a story that was half true and I let it be.',
      'I keep wanting a conclusion. There isn\'t one. She is still my mother.',
      'How much am I supposed to remember for her?',
    ],
    markings: [
      { kind: 'mark', para: 2, quote: 'I keep wanting a conclusion. There isn\'t one. She is still my mother.' },
      { kind: 'sense', para: 2, quote: 'I keep wanting a conclusion. There isn\'t one.' },
      { kind: 'sense', para: 1, quote: 'she told a story that was half true and I let it be' },
    ],
  },
  {
    id: 'e-2026-06-03',
    date: '2026-06-03',
    capture: 'car',
    paragraphs: [
      'Waiting at pickup. Mira said she doesn\'t want to go in.',
      'I told her I would be right here.',
    ],
    markings: [{ kind: 'underline', para: 1, quote: 'I would be right here' }],
  },
  {
    id: 'e-2026-06-22',
    date: '2026-06-22',
    paragraphs: [
      'Isaiah again. A new thing. I am almost embarrassed by how often it finds me.',
      'Maybe the new thing is not a change in circumstance. Maybe it is that I am still here, still asking.',
      'What if the new thing is only that I keep showing up?',
    ],
    markings: [
      { kind: 'scripture', ref: 'Isaiah 43:19', para: 0, quote: 'Isaiah again. A new thing. I am almost embarrassed by how often it finds me.' },
      { kind: 'learned', para: 1, quote: 'Maybe the new thing is not a change in circumstance. Maybe it is that I am still here, still asking.' },
    ],
  },
  {
    id: 'e-2026-07-14',
    date: '2026-07-14',
    paragraphs: [
      'I want to be praying about David the way I used to, before I turned it into a project.',
      'He fell asleep on the couch with a book on his chest. I covered him with the ugly blanket and did not wake him.',
      'When did I start managing him instead of loving him?',
    ],
    markings: [
      { kind: 'desire', para: 0, quote: 'I want to be praying about David the way I used to, before I turned it into a project.' },
      { kind: 'story', para: 1, quote: 'I covered him with the ugly blanket and did not wake him.' },
    ],
  },
  {
    id: 'e-2026-08-04',
    date: '2026-08-04',
    paragraphs: [
      'Summer is ending and the kids can feel it. Leo is already performing being older.',
      'Mira asked if Grandma could come to the pool. I said maybe, which was a coward\'s answer.',
      'How do I tell her that maybe means no without telling her that maybe means no?',
      'How much of her do I get to remember?',
    ],
    markings: [
      { kind: 'mark', para: 1, quote: 'I said maybe, which was a coward\'s answer' },
    ],
  },
  {
    id: 'e-2026-08-16',
    date: '2026-08-16',
    paragraphs: [
      'Sat with Mom this afternoon. She held my hand like I was the child.',
      'I told her about Mira hiding in the coats and she laughed a real laugh.',
      'I do not know how many more afternoons like this there are. I am not going to make that into a sentence God has to answer.',
      'What am I supposed to do with a love that only knows how to sit still?',
    ],
    markings: [
      { kind: 'story', para: 1, quote: 'I told her about Mira hiding in the coats and she laughed a real laugh.' },
      { kind: 'story', para: 1, quote: 'she laughed a real laugh' },
      { kind: 'mark', para: 0, quote: 'She held my hand like I was the child.' },
      { kind: 'sense', para: 2, quote: 'I am not going to make that into a sentence God has to answer.' },
    ],
  },
]

// ── helpers ────────────────────────────────────────────────────────────────

export type PlacedMarking = Marking & { entryId: string; date: string }

export function allMarkings(entries: Entry[] = ENTRIES): PlacedMarking[] {
  const out: PlacedMarking[] = []
  for (const e of entries) {
    for (const m of e.markings ?? []) out.push({ ...m, entryId: e.id, date: e.date })
  }
  return out
}

export function markingsOf(entryId: string): Marking[] {
  return entryById(entryId)?.markings ?? []
}

export function linesOf(entries: Entry[] = ENTRIES): Line[] {
  const out: Line[] = []
  for (const e of entries) {
    e.paragraphs.forEach((text, index) => {
      out.push({ entryId: e.id, date: e.date, text, capture: e.capture, index })
    })
  }
  return out
}

export function entryById(id: string): Entry | undefined {
  return ENTRIES.find((e) => e.id === id)
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4))
}

export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7))
}

export const YEARS: number[] = [...new Set(ENTRIES.map((e) => yearOf(e.date)))].sort()

/** Rough stand-in for word_count. Drives the thickness of a day. */
export function heftOf(e: Entry): number {
  return e.paragraphs.reduce((n, p) => n + p.length, 0)
}

export function subjectsIn(e: Entry): Subject[] {
  const hay = e.paragraphs.join(' ').toLowerCase()
  return SUBJECTS.filter((s) => s.terms.some((t) => hay.includes(t)))
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatMonthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * The product's own grounding rule, enforced on the fixture.
 *
 * A marking that isn't a verbatim substring of the paragraph it claims is
 * exactly the failure Principle 4 exists to prevent — so the prototype refuses
 * to run rather than showing a quote nobody wrote.
 */
export function validateMarkings(): string[] {
  const problems: string[] = []
  for (const e of ENTRIES) {
    for (const m of e.markings ?? []) {
      const para = e.paragraphs[m.para]
      if (para === undefined) {
        problems.push(`${e.id}: marking points at paragraph ${m.para}, which does not exist`)
      } else if (!para.includes(m.quote)) {
        problems.push(`${e.id} p${m.para}: "${m.quote}" is not verbatim`)
      }
    }
  }
  return problems
}
