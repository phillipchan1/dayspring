/** Fictional journal for the recall prototype. Not a real person. */

export type Capture = 'typed' | 'car'

export type Entry = {
  id: string
  date: string
  capture?: Capture
  /** One thought per paragraph. Paragraphs are the lines. */
  paragraphs: string[]
}

export type Subject = {
  key: string
  label: string
  terms: string[]
}

export type Line = {
  entryId: string
  date: string
  text: string
  capture?: Capture
  index: number
}

export const SUBJECTS: Subject[] = [
  { key: 'mom', label: 'Mom', terms: ['mom', 'mother', 'mama'] },
  { key: 'kids', label: 'the kids', terms: ['leo', 'mira', 'kids'] },
  { key: 'david', label: 'David', terms: ['david'] },
  { key: 'isaiah', label: 'a new thing', terms: ['isaiah', 'new thing'] },
]

/** Recurring words the journal notices — Act 1.2. Not life-areas. */
export const SUGGESTED: Subject[] = [
  { key: 'mom', label: 'Mom', terms: ['mom', 'mother', 'mama'] },
  { key: 'leo', label: 'Leo', terms: ['leo'] },
  { key: 'mira', label: 'Mira', terms: ['mira'] },
  { key: 'david', label: 'David', terms: ['david'] },
  { key: 'isaiah', label: 'Isaiah', terms: ['isaiah'] },
]

export const ENTRIES: Entry[] = [
  {
    id: 'e-2025-01-08',
    date: '2025-01-08',
    paragraphs: [
      'First quiet morning of the year. The house is still and I am trying to remember how to sit.',
      'I want to be praying about my marriage this year. Not fixing David. Just bringing him.',
      'I keep making lists instead of actually talking to God about it.',
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
  },
  {
    id: 'e-2025-02-18',
    date: '2025-02-18',
    paragraphs: [
      'Church this morning. I was half-listening until Isaiah 43:19 — behold I am doing a new thing.',
      'I wrote it in the bulletin and then lost the bulletin in the van under Mira\'s seat.',
      'I don\'t know what the new thing is. I just know I have been asking for one.',
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
  },
  {
    id: 'e-2025-03-21',
    date: '2025-03-21',
    paragraphs: [
      'We argued about money. Not even a lot of money. The tone of it.',
      'After the kids were down I told David I was scared we were becoming roommates who share a calendar.',
      'He sat on the edge of the bed and didn\'t defend himself, which was either grace or exhaustion.',
      'I prayed for my marriage in the dark like I used to, before I had a system for it.',
    ],
  },
  {
    id: 'e-2025-04-09',
    date: '2025-04-09',
    paragraphs: [
      'Mira woke at 2 from a nightmare and would not tell me what it was.',
      'She just said stay, so I stayed.',
      'Leo slept through the whole thing, which felt like a small mercy and also like I was doing two different nights at once.',
    ],
  },
  {
    id: 'e-2025-04-27',
    date: '2025-04-27',
    paragraphs: [
      'Drove to Mom\'s. She was in the garden with the tomatoes and she knew my name.',
      'We sat on the back step and she asked about the kids as if she had been saving the question.',
      'I did not want to leave. I left anyway, because Leo had a game.',
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
  },
  {
    id: 'e-2025-06-02',
    date: '2025-06-02',
    paragraphs: [
      'David took me out. No occasion. He had already asked my sister to take the kids.',
      'I cried in the car on the way home, which I hated, and he didn\'t try to fix it.',
      'I want to remember that he still knows how to do this.',
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
  },
  {
    id: 'e-2025-08-15',
    date: '2025-08-15',
    paragraphs: [
      'Mom is in the hospital. Not the bad kind of sentence, they said, and then they said we should come.',
      'I sat in the hallway and wrote this on my phone because I could not sit there doing nothing and I also could not pray out loud.',
      'She looked small. I hated that I thought that. I am leaving it anyway.',
      'Leo asked if Grandma was dying. I said I don\'t know, which was the first honest thing I had said all day.',
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
  },
  {
    id: 'e-2025-10-11',
    date: '2025-10-11',
    paragraphs: [
      'Marriage feels like a hallway this month. We pass. We are kind. We do not stop.',
      'I miss David in the specific way you miss someone who is still in the house.',
      'I prayed about it for four minutes and then folded laundry, which is also a kind of prayer if I am being generous, and I am not sure I should be.',
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
  },
  {
    id: 'e-2025-12-24',
    date: '2025-12-24',
    paragraphs: [
      'Christmas Eve. The kids put out the plates for cookies like it still works.',
      'David read the Luke passage and his voice went quiet at the shepherds, the way it does every year.',
      'I was glad for a night that asked so little of me.',
    ],
  },
  {
    id: 'e-2026-01-06',
    date: '2026-01-06',
    paragraphs: [
      'Another January. I wrote last year that I wanted to pray about my marriage, and I did, in fits.',
      'I am not making a plan this time. I am just going to keep bringing David when I sit down.',
    ],
  },
  {
    id: 'e-2026-02-14',
    date: '2026-02-14',
    paragraphs: [
      'David left a note on the counter. Not a production. Just my name and a line from a song we used to know.',
      'The kids made him a card with too much glue. He put it on the fridge like it was serious.',
    ],
  },
  {
    id: 'e-2026-03-01',
    date: '2026-03-01',
    paragraphs: [
      'Leo said he thinks he is bad at friends. I sat on the floor of his room and did not rush him.',
      'Mira practiced writing her name with the R backwards and was proud anyway.',
    ],
  },
  {
    id: 'e-2026-04-18',
    date: '2026-04-18',
    paragraphs: [
      'Mira did not want to go to the birthday party. She hid in the coat closet.',
      'I sat outside the door and talked to the coats until she laughed, which felt like cheating and also like the only thing that worked.',
    ],
  },
  {
    id: 'e-2026-05-09',
    date: '2026-05-09',
    paragraphs: [
      'I went to see Mom. She is home. She is smaller. She knew me after a minute.',
      'We looked at old photographs and she told a story that was half true and I let it be.',
      'I keep wanting a conclusion. There isn\'t one. She is still my mother.',
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
  },
  {
    id: 'e-2026-06-22',
    date: '2026-06-22',
    paragraphs: [
      'Isaiah again. A new thing. I am almost embarrassed by how often it finds me.',
      'Maybe the new thing is not a change in circumstance. Maybe it is that I am still here, still asking.',
    ],
  },
  {
    id: 'e-2026-07-14',
    date: '2026-07-14',
    paragraphs: [
      'I want to be praying about David the way I used to, before I turned it into a project.',
      'He fell asleep on the couch with a book on his chest. I covered him with the ugly blanket and did not wake him.',
    ],
  },
  {
    id: 'e-2026-08-04',
    date: '2026-08-04',
    paragraphs: [
      'Summer is ending and the kids can feel it. Leo is already performing being older.',
      'Mira asked if Grandma could come to the pool. I said maybe, which was a coward\'s answer.',
    ],
  },
  {
    id: 'e-2026-08-16',
    date: '2026-08-16',
    paragraphs: [
      'Sat with Mom this afternoon. She held my hand like I was the child.',
      'I told her about Mira hiding in the coats and she laughed a real laugh.',
      'I do not know how many more afternoons like this there are. I am not going to make that into a sentence God has to answer.',
    ],
  },
]

export const ECHO = {
  afterEntryId: 'e-2026-08-16',
  fromEntryId: 'e-2025-04-27',
  line: 'She was in the garden with the tomatoes and she knew my name.',
  marked: 'Mom',
} as const

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

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
