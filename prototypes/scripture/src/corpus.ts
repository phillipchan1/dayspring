// Public-domain WEB excerpts for mock display only.
// UI labels say ESV where the real app would; text here is abbreviated for the prototype.

export interface Verse {
  n: number
  text: string
}

export interface Chapter {
  book: string
  chapter: number
  verses: Verse[]
}

export const JAMES_4_8 =
  'Draw near to God, and he will draw near to you. Cleanse your hands, you sinners; and purify your hearts, you double-minded.'

export const JAMES_CH4: Chapter = {
  book: 'James',
  chapter: 4,
  verses: [
    { n: 1, text: "Where do wars and fightings among you come from? Don't they come from your pleasures that war in your members?" },
    { n: 2, text: "You lust, and don't have. You murder and covet, and can't obtain. You fight and make war. You don't have, because you don't ask." },
    { n: 3, text: "You ask, and don't receive, because you ask with wrong motives, so that you may spend it on your pleasures." },
    { n: 4, text: "You adulterers and adulteresses, don't you know that friendship with the world is hostility toward God? Whoever therefore wants to be a friend of the world makes himself an enemy of God." },
    { n: 5, text: 'Or do you think that the Scripture says in vain, "The Spirit who lives in us yearns jealously"?' },
    { n: 6, text: 'But he gives more grace. Therefore it says, "God resists the proud, but gives grace to the humble."' },
    { n: 7, text: 'Be subject therefore to God. Resist the devil, and he will flee from you.' },
    { n: 8, text: JAMES_4_8 },
    { n: 9, text: 'Lament, mourn, and weep. Let your laughter be turned to mourning, and your joy to gloom.' },
    { n: 10, text: 'Humble yourselves in the sight of the Lord, and he will exalt you.' },
    { n: 11, text: "Don't speak against one another, brothers. He who speaks against a brother and judges his brother, speaks against the law and judges the law." },
    { n: 12, text: 'Only one is the lawgiver, who is able to save and to destroy. But who are you to judge another?' },
  ],
}

export const COLOSSIANS: Chapter[] = [
  {
    book: 'Colossians',
    chapter: 1,
    verses: [
      { n: 1, text: 'Paul, an apostle of Christ Jesus through the will of God, and Timothy our brother,' },
      { n: 2, text: 'to the saints and faithful brothers in Christ at Colossae: Grace to you and peace from God our Father and the Lord Jesus Christ.' },
      { n: 3, text: 'We give thanks to God the Father of our Lord Jesus Christ, praying always for you,' },
      { n: 4, text: 'having heard of your faith in Christ Jesus and of the love which you have toward all the saints,' },
      { n: 5, text: 'because of the hope which is laid up for you in the heavens, of which you heard before in the word of the truth of the Good News' },
      { n: 9, text: "For this cause, we also, since the day we heard this, don't cease praying and making requests for you, that you may be filled with the knowledge of his will in all spiritual wisdom and understanding," },
      { n: 15, text: 'He is the image of the invisible God, the firstborn of all creation.' },
      { n: 16, text: 'For by him all things were created, in the heavens and on the earth, things visible and things invisible, whether thrones or dominions or principalities or powers; all things have been created through him and for him.' },
      { n: 17, text: 'He is before all things, and in him all things are held together.' },
      { n: 18, text: 'He is the head of the body, the assembly, who is the beginning, the firstborn from the dead; that in all things he might have the preeminence.' },
    ],
  },
  {
    book: 'Colossians',
    chapter: 2,
    verses: [
      { n: 1, text: 'For I desire to have you know how greatly I struggle for you, and for those at Laodicea, and for as many as have not seen my face in the flesh;' },
      { n: 2, text: 'that their hearts may be comforted, they being knit together in love, and gaining all riches of the full assurance of understanding, that they may know the mystery of God, both of the Father and of Christ,' },
      { n: 6, text: 'As therefore you received Christ Jesus, the Lord, walk in him,' },
      { n: 7, text: 'rooted and built up in him, and established in the faith, even as you were taught, abounding in it in thanksgiving.' },
      { n: 8, text: "Be careful that you don't let anyone rob you through his philosophy and vain deceit, after the tradition of men, after the elements of the world, and not after Christ." },
    ],
  },
  {
    book: 'Colossians',
    chapter: 3,
    verses: [
      { n: 1, text: 'If then you were raised together with Christ, seek the things that are above, where Christ is, seated on the right hand of God.' },
      { n: 2, text: 'Set your mind on the things that are above, not on the things that are on the earth.' },
      { n: 12, text: "Put on therefore, as God's chosen ones, holy and beloved, a heart of compassion, kindness, lowliness, humility, and perseverance;" },
      { n: 15, text: 'And let the peace of God rule in your hearts, to which also you were called in one body; and be thankful.' },
    ],
  },
]

export const COLOSSIANS_HITS = [
  {
    reference: 'Colossians 1:15-17',
    reason: 'Christ is the image of the invisible God',
    text: 'He is the image of the invisible God, the firstborn of all creation. For by him all things were created…',
  },
  {
    reference: 'Colossians 3:2',
    reason: 'Set your mind on things above',
    text: 'Set your mind on the things that are above, not on the things that are on the earth.',
  },
  {
    reference: 'Colossians 2:6-7',
    reason: 'Walk in him, rooted and built up',
    text: 'As therefore you received Christ Jesus, the Lord, walk in him, rooted and built up in him…',
  },
]

export const ENTRY_DATE = 'Tuesday, Aug 12'

export const ENTRY_BEFORE =
  "Something shifted in small group last night. I kept hearing the same phrase — draw near — and I couldn't shake it."

export const ENTRY_AFTER =
  'I want to sit with the rest of the chapter. What else is there besides the one line I copied?'

export const PASTED_VERSE = JAMES_4_8
