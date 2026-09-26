/**
 * DEV-ONLY verse text for the `?__preview=` harnesses, which have no sign-in and
 * so cannot reach the ESV endpoint. Never reached in a production build: every
 * import sits behind `import.meta.env.DEV`, which Vite folds to false.
 *
 * World English Bible (public domain), fetched from bible-api.com on
 * 2026-09-26 — never model memory (GUARDRAILS H3). Keys are canon names.
 */
import type { Verse } from './passage'

export const FIXTURE_CHAPTERS: Record<string, Verse[]> = {
  "John 15": [
    {
      "n": 1,
      "text": "“I am the true vine, and my Father is the farmer."
    },
    {
      "n": 2,
      "text": "Every branch in me that doesn’t bear fruit, he takes away. Every branch that bears fruit, he prunes, that it may bear more fruit."
    },
    {
      "n": 3,
      "text": "You are already pruned clean because of the word which I have spoken to you."
    },
    {
      "n": 4,
      "text": "Remain in me, and I in you. As the branch can’t bear fruit by itself, unless it remains in the vine, so neither can you, unless you remain in me."
    },
    {
      "n": 5,
      "text": "I am the vine. You are the branches. He who remains in me, and I in him, the same bears much fruit, for apart from me you can do nothing."
    },
    {
      "n": 6,
      "text": "If a man doesn’t remain in me, he is thrown out as a branch, and is withered; and they gather them, throw them into the fire, and they are burned."
    },
    {
      "n": 7,
      "text": "If you remain in me, and my words remain in you, you will ask whatever you desire, and it will be done for you."
    },
    {
      "n": 8,
      "text": "“In this is my Father glorified, that you bear much fruit; and so you will be my disciples."
    },
    {
      "n": 9,
      "text": "Even as the Father has loved me, I also have loved you. Remain in my love."
    },
    {
      "n": 10,
      "text": "If you keep my commandments, you will remain in my love; even as I have kept my Father’s commandments, and remain in his love."
    },
    {
      "n": 11,
      "text": "I have spoken these things to you, that my joy may remain in you, and that your joy may be made full."
    },
    {
      "n": 12,
      "text": "“This is my commandment, that you love one another, even as I have loved you."
    },
    {
      "n": 13,
      "text": "Greater love has no one than this, that someone lay down his life for his friends."
    },
    {
      "n": 14,
      "text": "You are my friends, if you do whatever I command you."
    },
    {
      "n": 15,
      "text": "No longer do I call you servants, for the servant doesn’t know what his lord does. But I have called you friends, for everything that I heard from my Father, I have made known to you."
    },
    {
      "n": 16,
      "text": "You didn’t choose me, but I chose you, and appointed you, that you should go and bear fruit, and that your fruit should remain; that whatever you will ask of the Father in my name, he may give it to you."
    },
    {
      "n": 17,
      "text": "“I command these things to you, that you may love one another."
    },
    {
      "n": 18,
      "text": "If the world hates you, you know that it has hated me before it hated you."
    },
    {
      "n": 19,
      "text": "If you were of the world, the world would love its own. But because you are not of the world, since I chose you out of the world, therefore the world hates you."
    },
    {
      "n": 20,
      "text": "Remember the word that I said to you: ‘A servant is not greater than his lord.’ If they persecuted me, they will also persecute you. If they kept my word, they will also keep yours."
    },
    {
      "n": 21,
      "text": "But all these things will they do to you for my name’s sake, because they don’t know him who sent me."
    },
    {
      "n": 22,
      "text": "If I had not come and spoken to them, they would not have had sin; but now they have no excuse for their sin."
    },
    {
      "n": 23,
      "text": "He who hates me, hates my Father also."
    },
    {
      "n": 24,
      "text": "If I hadn’t done among them the works which no one else did, they wouldn’t have had sin. But now have they seen and also hated both me and my Father."
    },
    {
      "n": 25,
      "text": "But this happened so that the word may be fulfilled which was written in their law, ‘They hated me without a cause.’"
    },
    {
      "n": 26,
      "text": "“When the Counselor has come, whom I will send to you from the Father, the Spirit of truth, who proceeds from the Father, he will testify about me."
    },
    {
      "n": 27,
      "text": "You will also testify, because you have been with me from the beginning."
    }
  ],
  "Mark 4": [
    {
      "n": 1,
      "text": "Again he began to teach by the seaside. A great multitude was gathered to him, so that he entered into a boat in the sea, and sat down. All the multitude were on the land by the sea."
    },
    {
      "n": 2,
      "text": "He taught them many things in parables, and told them in his teaching,"
    },
    {
      "n": 3,
      "text": "“Listen! Behold, the farmer went out to sow,"
    },
    {
      "n": 4,
      "text": "and as he sowed, some seed fell by the road, and the birds came and devoured it."
    },
    {
      "n": 5,
      "text": "Others fell on the rocky ground, where it had little soil, and immediately it sprang up, because it had no depth of soil."
    },
    {
      "n": 6,
      "text": "When the sun had risen, it was scorched; and because it had no root, it withered away."
    },
    {
      "n": 7,
      "text": "Others fell among the thorns, and the thorns grew up, and choked it, and it yielded no fruit."
    },
    {
      "n": 8,
      "text": "Others fell into the good ground, and yielded fruit, growing up and increasing. Some produced thirty times, some sixty times, and some one hundred times as much.”"
    },
    {
      "n": 9,
      "text": "He said, “Whoever has ears to hear, let him hear.”"
    },
    {
      "n": 10,
      "text": "When he was alone, those who were around him with the twelve asked him about the parables."
    },
    {
      "n": 11,
      "text": "He said to them, “To you is given the mystery of God’s Kingdom, but to those who are outside, all things are done in parables,"
    },
    {
      "n": 12,
      "text": "that ‘seeing they may see, and not perceive; and hearing they may hear, and not understand; lest perhaps they should turn again, and their sins should be forgiven them.’”"
    },
    {
      "n": 13,
      "text": "He said to them, “Don’t you understand this parable? How will you understand all of the parables?"
    },
    {
      "n": 14,
      "text": "The farmer sows the word."
    },
    {
      "n": 15,
      "text": "The ones by the road are the ones where the word is sown; and when they have heard, immediately Satan comes, and takes away the word which has been sown in them."
    },
    {
      "n": 16,
      "text": "These in the same way are those who are sown on the rocky places, who, when they have heard the word, immediately receive it with joy."
    },
    {
      "n": 17,
      "text": "They have no root in themselves, but are short-lived. When oppression or persecution arises because of the word, immediately they stumble."
    },
    {
      "n": 18,
      "text": "Others are those who are sown among the thorns. These are those who have heard the word,"
    },
    {
      "n": 19,
      "text": "and the cares of this age, and the deceitfulness of riches, and the lusts of other things entering in choke the word, and it becomes unfruitful."
    },
    {
      "n": 20,
      "text": "Those which were sown on the good ground are those who hear the word, and accept it, and bear fruit, some thirty times, some sixty times, and some one hundred times.”"
    },
    {
      "n": 21,
      "text": "He said to them, “Is the lamp brought to be put under a basket or under a bed? Isn’t it put on a stand?"
    },
    {
      "n": 22,
      "text": "For there is nothing hidden, except that it should be made known; neither was anything made secret, but that it should come to light."
    },
    {
      "n": 23,
      "text": "If any man has ears to hear, let him hear.”"
    },
    {
      "n": 24,
      "text": "He said to them, “Take heed what you hear. With whatever measure you measure, it will be measured to you, and more will be given to you who hear."
    },
    {
      "n": 25,
      "text": "For whoever has, to him will more be given, and he who doesn’t have, even that which he has will be taken away from him.”"
    },
    {
      "n": 26,
      "text": "He said, “God’s Kingdom is as if a man should cast seed on the earth,"
    },
    {
      "n": 27,
      "text": "and should sleep and rise night and day, and the seed should spring up and grow, though he doesn’t know how."
    },
    {
      "n": 28,
      "text": "For the earth bears fruit: first the blade, then the ear, then the full grain in the ear."
    },
    {
      "n": 29,
      "text": "But when the fruit is ripe, immediately he puts in the sickle, because the harvest has come.”"
    },
    {
      "n": 30,
      "text": "He said, “How will we liken God’s Kingdom? Or with what parable will we illustrate it?"
    },
    {
      "n": 31,
      "text": "It’s like a grain of mustard seed, which, when it is sown in the earth, though it is less than all the seeds that are on the earth,"
    },
    {
      "n": 32,
      "text": "yet when it is sown, grows up, and becomes greater than all the herbs, and puts out great branches, so that the birds of the sky can lodge under its shadow.”"
    },
    {
      "n": 33,
      "text": "With many such parables he spoke the word to them, as they were able to hear it."
    },
    {
      "n": 34,
      "text": "Without a parable he didn’t speak to them; but privately to his own disciples he explained everything."
    },
    {
      "n": 35,
      "text": "On that day, when evening had come, he said to them, “Let’s go over to the other side.”"
    },
    {
      "n": 36,
      "text": "Leaving the multitude, they took him with them, even as he was, in the boat. Other small boats were also with him."
    },
    {
      "n": 37,
      "text": "A big wind storm arose, and the waves beat into the boat, so much that the boat was already filled."
    },
    {
      "n": 38,
      "text": "He himself was in the stern, asleep on the cushion, and they woke him up, and told him, “Teacher, don’t you care that we are dying?”"
    },
    {
      "n": 39,
      "text": "He awoke, and rebuked the wind, and said to the sea, “Peace! Be still!” The wind ceased, and there was a great calm."
    },
    {
      "n": 40,
      "text": "He said to them, “Why are you so afraid? How is it that you have no faith?”"
    },
    {
      "n": 41,
      "text": "They were greatly afraid, and said to one another, “Who then is this, that even the wind and the sea obey him?”"
    }
  ],
  "Psalms 23": [
    {
      "n": 1,
      "text": "Yahweh is my shepherd: I shall lack nothing."
    },
    {
      "n": 2,
      "text": "He makes me lie down in green pastures. He leads me beside still waters."
    },
    {
      "n": 3,
      "text": "He restores my soul. He guides me in the paths of righteousness for his name’s sake."
    },
    {
      "n": 4,
      "text": "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me."
    },
    {
      "n": 5,
      "text": "You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over."
    },
    {
      "n": 6,
      "text": "Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahweh’s house forever."
    }
  ],
  "Luke 15": [
    {
      "n": 1,
      "text": "Now all the tax collectors and sinners were coming close to him to hear him."
    },
    {
      "n": 2,
      "text": "The Pharisees and the scribes murmured, saying, “This man welcomes sinners, and eats with them.”"
    },
    {
      "n": 3,
      "text": "He told them this parable."
    },
    {
      "n": 4,
      "text": "“Which of you men, if you had one hundred sheep, and lost one of them, wouldn’t leave the ninety-nine in the wilderness, and go after the one that was lost, until he found it?"
    },
    {
      "n": 5,
      "text": "When he has found it, he carries it on his shoulders, rejoicing."
    },
    {
      "n": 6,
      "text": "When he comes home, he calls together his friends and his neighbors, saying to them, ‘Rejoice with me, for I have found my sheep which was lost!’"
    },
    {
      "n": 7,
      "text": "I tell you that even so there will be more joy in heaven over one sinner who repents, than over ninety-nine righteous people who need no repentance."
    },
    {
      "n": 8,
      "text": "Or what woman, if she had ten drachma coins, if she lost one drachma coin, wouldn’t light a lamp, sweep the house, and seek diligently until she found it?"
    },
    {
      "n": 9,
      "text": "When she has found it, she calls together her friends and neighbors, saying, ‘Rejoice with me, for I have found the drachma which I had lost.’"
    },
    {
      "n": 10,
      "text": "Even so, I tell you, there is joy in the presence of the angels of God over one sinner repenting.”"
    },
    {
      "n": 11,
      "text": "He said, “A certain man had two sons."
    },
    {
      "n": 12,
      "text": "The younger of them said to his father, ‘Father, give me my share of your property.’ He divided his livelihood between them."
    },
    {
      "n": 13,
      "text": "Not many days after, the younger son gathered all of this together and traveled into a far country. There he wasted his property with riotous living."
    },
    {
      "n": 14,
      "text": "When he had spent all of it, there arose a severe famine in that country, and he began to be in need."
    },
    {
      "n": 15,
      "text": "He went and joined himself to one of the citizens of that country, and he sent him into his fields to feed pigs."
    },
    {
      "n": 16,
      "text": "He wanted to fill his belly with the husks that the pigs ate, but no one gave him any."
    },
    {
      "n": 17,
      "text": "But when he came to himself he said, ‘How many hired servants of my father’s have bread enough to spare, and I’m dying with hunger!"
    },
    {
      "n": 18,
      "text": "I will get up and go to my father, and will tell him, “Father, I have sinned against heaven, and in your sight."
    },
    {
      "n": 19,
      "text": "I am no more worthy to be called your son. Make me as one of your hired servants.”’"
    },
    {
      "n": 20,
      "text": "“He arose, and came to his father. But while he was still far off, his father saw him, and was moved with compassion, and ran, and fell on his neck, and kissed him."
    },
    {
      "n": 21,
      "text": "The son said to him, ‘Father, I have sinned against heaven, and in your sight. I am no longer worthy to be called your son.’"
    },
    {
      "n": 22,
      "text": "“But the father said to his servants, ‘Bring out the best robe, and put it on him. Put a ring on his hand, and shoes on his feet."
    },
    {
      "n": 23,
      "text": "Bring the fattened calf, kill it, and let us eat, and celebrate;"
    },
    {
      "n": 24,
      "text": "for this, my son, was dead, and is alive again. He was lost, and is found.’ They began to celebrate."
    },
    {
      "n": 25,
      "text": "“Now his elder son was in the field. As he came near to the house, he heard music and dancing."
    },
    {
      "n": 26,
      "text": "He called one of the servants to him, and asked what was going on."
    },
    {
      "n": 27,
      "text": "He said to him, ‘Your brother has come, and your father has killed the fattened calf, because he has received him back safe and healthy.’"
    },
    {
      "n": 28,
      "text": "But he was angry, and would not go in. Therefore his father came out, and begged him."
    },
    {
      "n": 29,
      "text": "But he answered his father, ‘Behold, these many years I have served you, and I never disobeyed a commandment of yours, but you never gave me a goat, that I might celebrate with my friends."
    },
    {
      "n": 30,
      "text": "But when this your son came, who has devoured your living with prostitutes, you killed the fattened calf for him.’"
    },
    {
      "n": 31,
      "text": "“He said to him, ‘Son, you are always with me, and all that is mine is yours."
    },
    {
      "n": 32,
      "text": "But it was appropriate to celebrate and be glad, for this, your brother, was dead, and is alive again. He was lost, and is found.’”"
    }
  ],
  "Matthew 11": [
    {
      "n": 25,
      "text": "At that time, Jesus answered, “I thank you, Father, Lord of heaven and earth, that you hid these things from the wise and understanding, and revealed them to infants."
    },
    {
      "n": 26,
      "text": "Yes, Father, for so it was well-pleasing in your sight."
    },
    {
      "n": 27,
      "text": "All things have been delivered to me by my Father. No one knows the Son, except the Father; neither does anyone know the Father, except the Son, and he to whom the Son desires to reveal him."
    },
    {
      "n": 28,
      "text": "“Come to me, all you who labor and are heavily burdened, and I will give you rest."
    },
    {
      "n": 29,
      "text": "Take my yoke upon you, and learn from me, for I am gentle and humble in heart; and you will find rest for your souls."
    },
    {
      "n": 30,
      "text": "For my yoke is easy, and my burden is light.”"
    }
  ]
}

/** What a journal's Scripture light looks like, for the finder's lit canon. */
export const FIXTURE_LIGHT = {
  books: new Map<string, number>([
    ['Ps', 9], ['John', 8], ['Mark', 5], ['Luke', 5], ['Matt', 6], ['Rom', 7], ['Col', 4],
    ['Jas', 3], ['Isa', 4], ['Phil', 4], ['Gen', 2], ['Lam', 3], ['Eph', 2], ['Heb', 2], ['1John', 2],
  ]),
  chapters: new Map<string, number>([
    ['Ps:23', 9], ['Ps:139', 6], ['Ps:27', 3], ['John:15', 8], ['John:14', 3], ['Mark:4', 5],
    ['Luke:15', 5], ['Matt:11', 4], ['Matt:6', 5], ['Rom:8', 7], ['Col:3', 4], ['Phil:4', 4],
  ]),
  max: 9,
  returning: ['Ps.23', 'John.15.5', 'Matt.11.28-Matt.11.30', 'Luke.15.11-Luke.15.32', 'Mark.4.39'],
}

/** Stand-ins for the model's picks on a word search. */
export const FIXTURE_TOPICS: { re: RegExp; refs: string[] }[] = [
  { re: /^(rest|tired|weary|burden|heavy)/i, refs: ['Matthew 11:28–30', 'Psalm 23:1–3'] },
  { re: /^(fear|afraid|anx|storm|worr)/i, refs: ['Mark 4:35–41', 'Psalm 23:4'] },
  { re: /^(lost|home|return|forgiv)/i, refs: ['Luke 15:11–32', 'Luke 15:1–7'] },
  { re: /^(abide|remain|fruit|vine|stay)/i, refs: ['John 15:1–11', 'John 15:4–5'] },
]
