interface OfflinePassage {
  reference: string
  text: string
  keywords: string[]
  reason: string
}

const PASSAGES: OfflinePassage[] = [
  // Peace / Anxiety
  {
    reference: 'Philippians 4:6-7',
    text: 'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.',
    keywords: ['anxious', 'anxiety', 'worry', 'worried', 'stress', 'stressed', 'nervous', 'peace', 'prayer', 'pray'],
    reason: 'A direct comfort for anxiety, pointing to prayer and God\'s peace.',
  },
  {
    reference: 'John 14:27',
    text: 'Peace I leave with you; my peace I give to you. Not as the world gives do I give to you. Let not your hearts be troubled, neither let them be afraid.',
    keywords: ['peace', 'troubled', 'afraid', 'fear', 'calm', 'rest', 'worry', 'anxiety'],
    reason: 'Jesus\' promise of peace that the world cannot give.',
  },
  {
    reference: 'Matthew 6:34',
    text: 'Therefore do not be anxious about tomorrow, for tomorrow will be anxious for itself. Sufficient for the day is its own trouble.',
    keywords: ['anxious', 'anxiety', 'tomorrow', 'future', 'worry', 'worried', 'today', 'present'],
    reason: 'A reminder to live in the present rather than worrying about tomorrow.',
  },
  {
    reference: 'Isaiah 26:3',
    text: 'You keep him in perfect peace whose mind is stayed on you, because he trusts in you.',
    keywords: ['peace', 'mind', 'trust', 'focus', 'still', 'calm', 'steady'],
    reason: 'Perfect peace comes from a mind fixed on God.',
  },
  // Hope / Future
  {
    reference: 'Jeremiah 29:11',
    text: 'For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.',
    keywords: ['future', 'plans', 'hope', 'purpose', 'direction', 'uncertain', 'unknown'],
    reason: 'God\'s promise of a purposeful future and a living hope.',
  },
  {
    reference: 'Romans 15:13',
    text: 'May the God of hope fill you with all joy and peace in believing, so that by the power of the Holy Spirit you may abound in hope.',
    keywords: ['hope', 'joy', 'peace', 'spirit', 'believing', 'faith'],
    reason: 'A blessing of hope, joy, and peace through the Spirit.',
  },
  {
    reference: 'Psalm 42:11',
    text: 'Why are you cast down, O my soul, and why are you in turmoil within me? Hope in God; for I shall again praise him, my salvation and my God.',
    keywords: ['hope', 'soul', 'turmoil', 'down', 'depressed', 'sad', 'discouraged', 'praise'],
    reason: 'A soul talking itself back to hope in God.',
  },
  {
    reference: 'Romans 8:28',
    text: 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.',
    keywords: ['good', 'purpose', 'hope', 'future', 'plan', 'hard', 'together'],
    reason: 'God works all things together for good for those who love him.',
  },
  // Strength / Courage
  {
    reference: 'Philippians 4:13',
    text: 'I can do all things through him who strengthens me.',
    keywords: ['strength', 'strong', 'able', 'overcome', 'hard', 'difficult', 'challenge', 'power'],
    reason: 'Confidence and strength through Christ.',
  },
  {
    reference: 'Isaiah 40:31',
    text: 'But they who wait for the Lord shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint.',
    keywords: ['strength', 'wait', 'waiting', 'weary', 'tired', 'exhausted', 'renew', 'rest'],
    reason: 'Those who wait on the Lord find renewed strength.',
  },
  {
    reference: 'Joshua 1:9',
    text: 'Have I not commanded you? Be strong and courageous. Do not be frightened, and do not be dismayed, for the Lord your God is with you wherever you go.',
    keywords: ['courage', 'courageous', 'strong', 'afraid', 'frightened', 'fear', 'brave', 'bold'],
    reason: 'A direct command to be strong and courageous — God is with you.',
  },
  {
    reference: 'Isaiah 41:10',
    text: 'Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.',
    keywords: ['fear', 'afraid', 'strength', 'help', 'alone', 'lonely', 'dismayed'],
    reason: 'God\'s promise to strengthen, help, and uphold you.',
  },
  // Love / Grace
  {
    reference: '1 Corinthians 13:4-7',
    text: 'Love is patient and kind; love does not envy or boast; it is not arrogant or rude. It does not insist on its own way; it is not irritable or resentful; it does not rejoice at wrongdoing, but rejoices with the truth. Love bears all things, believes all things, hopes all things, endures all things.',
    keywords: ['love', 'patient', 'kind', 'relationship', 'marriage', 'family', 'friend', 'hurt', 'resentful'],
    reason: 'The defining shape of love — patient, kind, and enduring.',
  },
  {
    reference: 'Romans 8:38-39',
    text: 'For I am sure that neither death nor life, nor angels nor rulers, nor things present nor things to come, nor powers, nor height nor depth, nor anything else in all creation, will be able to separate us from the love of God in Christ Jesus our Lord.',
    keywords: ['love', 'separate', 'alone', 'abandoned', 'rejected', 'secure'],
    reason: 'Nothing in creation can separate you from God\'s love.',
  },
  {
    reference: 'Lamentations 3:22-23',
    text: 'The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every morning; great is your faithfulness.',
    keywords: ['mercy', 'mercies', 'love', 'steadfast', 'morning', 'new', 'faithful', 'grace', 'fresh'],
    reason: 'God\'s mercies are new every morning — a daily renewal.',
  },
  // Prayer / Faith
  {
    reference: 'Matthew 7:7-8',
    text: 'Ask, and it will be given to you; seek, and you will find; knock, and it will be opened to you. For everyone who asks receives, and the one who seeks finds, and to the one who knocks it will be opened.',
    keywords: ['ask', 'seek', 'find', 'prayer', 'pray', 'request', 'search', 'looking'],
    reason: 'An invitation to ask, seek, and knock — God answers those who come.',
  },
  {
    reference: 'Psalm 46:10',
    text: 'Be still, and know that I am God. I will be exalted among the nations, I will be exalted in the earth!',
    keywords: ['still', 'quiet', 'rest', 'pause', 'calm', 'peace', 'presence'],
    reason: 'An invitation to stillness and the knowledge of God.',
  },
  {
    reference: 'Hebrews 11:1',
    text: 'Now faith is the assurance of things hoped for, the conviction of things not seen.',
    keywords: ['faith', 'hope', 'unseen', 'believe', 'trust', 'uncertainty', 'doubt'],
    reason: 'The nature of faith — confidence in what we cannot yet see.',
  },
  // Gratitude / Joy
  {
    reference: '1 Thessalonians 5:18',
    text: 'Give thanks in all circumstances; for this is the will of God in Christ Jesus for you.',
    keywords: ['thanks', 'thankful', 'grateful', 'gratitude', 'thankfulness'],
    reason: 'A call to give thanks in every circumstance.',
  },
  {
    reference: 'Psalm 100:4',
    text: 'Enter his gates with thanksgiving, and his courts with praise! Give thanks to him; bless his name!',
    keywords: ['thanksgiving', 'praise', 'gratitude', 'worship', 'bless', 'thanks', 'joy'],
    reason: 'Enter God\'s presence with a heart of thanksgiving and praise.',
  },
  {
    reference: 'Nehemiah 8:10',
    text: 'And do not be grieved, for the joy of the Lord is your strength.',
    keywords: ['joy', 'strength', 'grieved', 'sad', 'sorrow', 'happy'],
    reason: 'Joy in the Lord is itself a source of strength.',
  },
  // Suffering / Trial
  {
    reference: 'James 1:2-4',
    text: 'Count it all joy, my brothers, when you meet trials of various kinds, for you know that the testing of your faith produces steadfastness. And let steadfastness have its full effect, that you may be perfect and complete, lacking in nothing.',
    keywords: ['trial', 'trials', 'hard', 'hardship', 'difficult', 'testing', 'faith', 'persevere', 'struggle'],
    reason: 'Trials produce steadfastness and completeness in our faith.',
  },
  {
    reference: 'Romans 5:3-4',
    text: 'More than that, we rejoice in our sufferings, knowing that suffering produces endurance, and endurance produces character, and character produces hope.',
    keywords: ['suffering', 'suffer', 'endurance', 'character', 'hope', 'hard', 'difficult', 'pain', 'trial'],
    reason: 'Suffering forges endurance, character, and ultimately hope.',
  },
  {
    reference: '1 Peter 5:10',
    text: 'And after you have suffered a little while, the God of all grace, who has called you to his eternal glory in Christ, will himself restore, confirm, strengthen, and establish you.',
    keywords: ['suffering', 'suffer', 'restore', 'strengthen', 'grace', 'hard', 'broken'],
    reason: 'God himself will restore and strengthen you after suffering.',
  },
  // Guidance / Wisdom
  {
    reference: 'Proverbs 3:5-6',
    text: 'Trust in the Lord with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths.',
    keywords: ['trust', 'direction', 'guidance', 'path', 'decision', 'wisdom', 'understanding', 'way', 'lead'],
    reason: 'Trust God fully and he will direct your path.',
  },
  {
    reference: 'Psalm 119:105',
    text: 'Your word is a lamp to my feet and a light to my path.',
    keywords: ['guidance', 'direction', 'light', 'path', 'word', 'way', 'lead', 'lost'],
    reason: 'God\'s word illuminates the path ahead, one step at a time.',
  },
  {
    reference: 'James 1:5',
    text: 'If any of you lacks wisdom, let him ask God, who gives generously to all without reproach, and it will be given him.',
    keywords: ['wisdom', 'decision', 'guidance', 'discern', 'direction', 'choice'],
    reason: 'God gives wisdom generously to all who ask.',
  },
  // Forgiveness / Renewal
  {
    reference: '1 John 1:9',
    text: 'If we confess our sins, he is faithful and just to forgive us our sins and to cleanse us from all unrighteousness.',
    keywords: ['forgiveness', 'forgive', 'sin', 'confess', 'confession', 'guilt', 'shame', 'cleanse', 'repent'],
    reason: 'Confession leads to faithful forgiveness and full cleansing.',
  },
  {
    reference: 'Romans 8:1',
    text: 'There is therefore now no condemnation for those who are in Christ Jesus.',
    keywords: ['condemnation', 'shame', 'guilt', 'failure', 'sin', 'forgiven', 'free', 'condemned'],
    reason: 'There is no condemnation for those who are in Christ.',
  },
  {
    reference: 'Ephesians 4:32',
    text: 'Be kind to one another, tenderhearted, forgiving one another, as God in Christ forgave you.',
    keywords: ['forgiveness', 'forgive', 'kind', 'kindness', 'relationship', 'hurt', 'resentment', 'grudge'],
    reason: 'Forgive others as God has forgiven you.',
  },
  // Grief / Loss / Comfort
  {
    reference: 'Matthew 5:4',
    text: 'Blessed are those who mourn, for they shall be comforted.',
    keywords: ['grief', 'grieve', 'mourning', 'mourn', 'loss', 'sad', 'sorrow', 'comfort', 'death'],
    reason: 'Those who mourn are promised God\'s comfort.',
  },
  {
    reference: 'Psalm 34:18',
    text: 'The Lord is near to the brokenhearted and saves the crushed in spirit.',
    keywords: ['brokenhearted', 'broken', 'crushed', 'grief', 'sad', 'loss', 'hurt', 'pain', 'lonely'],
    reason: 'God draws near specifically to those who are brokenhearted.',
  },
  {
    reference: '2 Corinthians 1:3-4',
    text: 'Blessed be the God and Father of our Lord Jesus Christ, the Father of mercies and God of all comfort, who comforts us in all our affliction, so that we may be able to comfort those who are in any affliction, with the comfort with which we ourselves are comforted by God.',
    keywords: ['comfort', 'affliction', 'grief', 'suffering', 'pain', 'sorrow', 'mercies'],
    reason: 'God comforts us so we can comfort others — comfort flows forward.',
  },
  {
    reference: 'Revelation 21:4',
    text: 'He will wipe away every tear from their eyes, and death shall be no more, neither shall there be mourning, nor crying, nor pain anymore, for the former things have passed away.',
    keywords: ['grief', 'sorrow', 'tears', 'death', 'pain', 'heaven', 'eternity', 'hope', 'loss', 'mourning'],
    reason: 'A vision of the end of all sorrow — God wipes every tear.',
  },
  // Waiting / Patience
  {
    reference: 'Psalm 27:14',
    text: 'Wait for the Lord; be strong, and let your heart take courage; wait for the Lord!',
    keywords: ['wait', 'waiting', 'patience', 'patient', 'delay', 'slow', 'courage'],
    reason: 'A call to wait on the Lord with courage.',
  },
  {
    reference: 'Lamentations 3:25',
    text: 'The Lord is good to those who wait for him, to the soul who seeks him.',
    keywords: ['wait', 'waiting', 'patience', 'good', 'seek', 'seeking', 'trust'],
    reason: 'The Lord is good to those who wait and seek him.',
  },
  // Identity / Worth
  {
    reference: 'Psalm 139:14',
    text: 'I praise you, for I am fearfully and wonderfully made. Wonderful are your works; my soul knows it very well.',
    keywords: ['identity', 'worth', 'value', 'made', 'created', 'self', 'insecurity', 'body'],
    reason: 'You are fearfully and wonderfully made — God\'s handiwork.',
  },
  {
    reference: 'Galatians 2:20',
    text: 'I have been crucified with Christ. It is no longer I who live, but Christ who lives in me. And the life I now live in the flesh I live by faith in the Son of God, who loved me and gave himself for me.',
    keywords: ['identity', 'christ', 'faith', 'love', 'live', 'self', 'life', 'crucified'],
    reason: 'Our new identity: Christ lives in us, and we live by faith.',
  },
  // Purpose / Calling
  {
    reference: 'Colossians 3:23',
    text: 'Whatever you do, work heartily, as for the Lord and not for men.',
    keywords: ['work', 'job', 'calling', 'purpose', 'effort', 'motivation', 'vocation', 'labor'],
    reason: 'Work done for the Lord has eternal weight and worth.',
  },
  {
    reference: 'Ephesians 2:10',
    text: 'For we are his workmanship, created in Christ Jesus for good works, which God prepared beforehand, that we should walk in them.',
    keywords: ['purpose', 'work', 'created', 'made', 'calling', 'identity', 'workmanship'],
    reason: 'You are God\'s workmanship, created for good works he prepared.',
  },
  {
    reference: 'Micah 6:8',
    text: 'He has told you, O man, what is good; and what does the Lord require of you but to do justice, and to love kindness, and to walk humbly with your God?',
    keywords: ['purpose', 'calling', 'justice', 'kindness', 'humble', 'walk', 'good', 'mission'],
    reason: 'The simple, profound summary of what God requires.',
  },
]

export function matchOfflinePassages(
  content: string,
  count = 5,
): Array<{ reference: string; text: string; reason: string }> {
  const lower = content.toLowerCase()
  const words = new Set(lower.match(/\b\w+\b/g) ?? [])

  const scored = PASSAGES.map((p) => {
    const hits = p.keywords.filter((k) =>
      k.includes(' ') ? lower.includes(k) : words.has(k),
    ).length
    return { p, hits }
  })

  scored.sort((a, b) => b.hits - a.hits || Math.random() - 0.5)

  return scored.slice(0, count).map(({ p }) => ({
    reference: p.reference,
    text: p.text,
    reason: p.reason,
  }))
}
