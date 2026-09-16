/**
 * An archive at volume.
 *
 * Phil's real archive holds twelve ritual blocks across 2,994 entries, and the
 * deepest single movement has four answers — two of which are keyboard-mashing
 * from a test. `real.local.json` carries that, exactly, and the prototype will show it
 * to you on request. But you cannot judge a surface whose whole subject is depth
 * on an archive with none, so this is what the same surface looks like over a
 * writer's five months.
 *
 * Every word below is invented. It is written the way people actually journal —
 * uneven, sometimes two words, sometimes a paragraph, occasionally the same
 * worry three weeks running without the writer noticing. That unevenness is the
 * point: a thread is only worth building if it survives contact with ordinary
 * writing, and a fixture of well-formed devotional prose would prove nothing.
 *
 * Nothing here is generated at runtime and nothing is summarised. What you see
 * on the screen is this text, verbatim, in date order.
 */
import type { Archive } from './model'

const morningOffering = {
  practice: 'The Morning Offering',
  walks: 18,
  firstAt: '2026-04-14T06:20:00Z',
  lastAt: '2026-09-12T06:11:00Z',
  movements: [
    {
      label: 'Everything',
      question:
        'Put down everything you are carrying into today. No order, no editing, nothing left out because it seems small.',
      answers: [
        {
          entryId: 'e-mo-18',
          at: '2026-09-12T06:11:00Z',
          text: "Q3 numbers. The thing I said to Dan on Tuesday that I keep replaying. Mum's scan results, which are Thursday. Car is making the noise again. I haven't called Pete back in three weeks. Sermon prep for the 21st, nothing written. Feeling behind on everything and it's Saturday.",
        },
        {
          entryId: 'e-mo-17',
          at: '2026-09-05T06:34:00Z',
          text: "School run, standing meeting, the budget thing. Mum's appointment moved again. I keep opening the laptop before I've prayed and I know exactly what that does to the day.",
        },
        {
          entryId: 'e-mo-16',
          at: '2026-08-29T06:02:00Z',
          text: 'Tired. Not much in the tank. Ella starts Tuesday and I want to be present for it and I am already thinking about the review on Wednesday instead.',
        },
        {
          entryId: 'e-mo-15',
          at: '2026-08-22T07:15:00Z',
          text: "Holiday washing everywhere. Back to it Monday. That low dread I get on the last Saturday — it's not about work exactly, it's about going back to being the version of me that work makes.",
        },
        {
          entryId: 'e-mo-14',
          at: '2026-08-08T06:40:00Z',
          text: "Deadline. Deadline. The conversation with Dan I'm still not having. Whether we can afford the boiler. Whether I'm actually any good at this or just persistent.",
        },
        {
          entryId: 'e-mo-13',
          at: '2026-07-25T06:18:00Z',
          text: 'Not much this morning, genuinely. Bit of admin. That is the first time I have written that in months.',
        },
        {
          entryId: 'e-mo-12',
          at: '2026-07-18T06:29:00Z',
          text: "Dan again. I've written his name in this box four weeks running and not once written what I actually need to say to him.",
        },
        {
          entryId: 'e-mo-11',
          at: '2026-07-11T06:45:00Z',
          text: "Money. Mum. Dan. The sense that I am managing all three badly and that if I were better organised none of them would be hard. Which I don't think is true but I believe it at 6am.",
        },
        {
          entryId: 'e-mo-10',
          at: '2026-07-04T06:22:00Z',
          text: 'Interview prep for Sam. Roof quote. Whether to say yes to the Thursday group — I want to and I also know what saying yes costs on a Thursday.',
        },
        {
          entryId: 'e-mo-09',
          at: '2026-06-27T06:50:00Z',
          text: "Everything is fine and I am carrying it like it isn't.",
        },
        {
          entryId: 'e-mo-08',
          at: '2026-06-20T06:12:00Z',
          text: "Mum's results. Work is loud. I've been short with Ella twice this week over nothing and both times I saw myself doing it.",
        },
        {
          entryId: 'e-mo-07',
          at: '2026-06-13T06:36:00Z',
          text: 'The pitch. Rain. Bins. Pete. My back.',
        },
        {
          entryId: 'e-mo-06',
          at: '2026-06-06T06:08:00Z',
          text: "Quiet head today which is unusual enough to write down. Just the ordinary list — shopping, the call at 11, getting the car booked in.",
        },
        {
          entryId: 'e-mo-05',
          at: '2026-05-23T06:41:00Z',
          text: "Dan. I don't even know what the issue is, only that I brace before every meeting with him and I've stopped noticing that I do it.",
        },
        {
          entryId: 'e-mo-04',
          at: '2026-05-16T07:02:00Z',
          text: "Late start. Whole day already feels borrowed. The list is: the report, the call, the thing with the neighbours, and underneath all of it, am I doing the right work at all.",
        },
        {
          entryId: 'e-mo-03',
          at: '2026-05-02T06:27:00Z',
          text: "Ella's birthday planning. Work, but manageable. The thing I keep not doing about my own health.",
        },
        {
          entryId: 'e-mo-02',
          at: '2026-04-25T06:33:00Z',
          text: 'New team starts Monday and I am more nervous than I would admit to anyone who asked directly.',
        },
        {
          entryId: 'e-mo-01',
          at: '2026-04-14T06:20:00Z',
          text: "First go at this. Feels odd writing a list to God. Everything: work handover, Mum, the house, and a general low hum I can't name that has been there since March.",
        },
      ],
    },
    {
      label: 'What matters',
      question:
        'Read back what you just wrote. What is the one thing today is actually for?',
      answers: [
        {
          entryId: 'e-mo-18',
          at: '2026-09-12T06:11:00Z',
          text: 'Being actually present at lunch with Mum before Thursday. Not rehearsing Thursday during it.',
        },
        {
          entryId: 'e-mo-17',
          at: '2026-09-05T06:34:00Z',
          text: 'Not opening the laptop until after breakfast. That is the whole thing today.',
        },
        {
          entryId: 'e-mo-16',
          at: '2026-08-29T06:02:00Z',
          text: "Ella. Tuesday is hers, not Wednesday's.",
        },
        {
          entryId: 'e-mo-15',
          at: '2026-08-22T07:15:00Z',
          text: 'Today is for finishing the holiday well instead of spending it on Monday.',
        },
        {
          entryId: 'e-mo-14',
          at: '2026-08-08T06:40:00Z',
          text: 'Talking to Dan. Not preparing to talk to Dan.',
        },
        {
          entryId: 'e-mo-13',
          at: '2026-07-25T06:18:00Z',
          text: 'Rest, apparently. I am going to let that be enough.',
        },
        {
          entryId: 'e-mo-12',
          at: '2026-07-18T06:29:00Z',
          text: 'Saying the thing to Dan.',
        },
        {
          entryId: 'e-mo-11',
          at: '2026-07-11T06:45:00Z',
          text: 'Ringing Mum without an agenda.',
        },
        {
          entryId: 'e-mo-10',
          at: '2026-07-04T06:22:00Z',
          text: "Giving Sam a fair hearing — I've already decided about him and that isn't fair.",
        },
        {
          entryId: 'e-mo-09',
          at: '2026-06-27T06:50:00Z',
          text: 'Putting things down. Literally that.',
        },
        {
          entryId: 'e-mo-08',
          at: '2026-06-20T06:12:00Z',
          text: 'Being gentle with Ella. I keep writing versions of this.',
        },
        {
          entryId: 'e-mo-07',
          at: '2026-06-13T06:36:00Z',
          text: 'The pitch, honestly. Today is a work day and pretending otherwise would be the dishonest answer.',
        },
        {
          entryId: 'e-mo-06',
          at: '2026-06-06T06:08:00Z',
          text: "Nothing dramatic. Doing the ordinary things well and not needing today to be significant.",
        },
        {
          entryId: 'e-mo-05',
          at: '2026-05-23T06:41:00Z',
          text: 'Noticing when I brace. Just noticing it, not fixing it yet.',
        },
        {
          entryId: 'e-mo-04',
          at: '2026-05-16T07:02:00Z',
          text: 'Getting one real thing done rather than touching nine.',
        },
        {
          entryId: 'e-mo-03',
          at: '2026-05-02T06:27:00Z',
          text: "Booking the appointment. It's been four months.",
        },
        {
          entryId: 'e-mo-02',
          at: '2026-04-25T06:33:00Z',
          text: 'Preparing properly instead of worrying, which are not the same thing though I do them at the same time.',
        },
        {
          entryId: 'e-mo-01',
          at: '2026-04-14T06:20:00Z',
          text: 'I genuinely do not know. Starting, maybe.',
        },
      ],
    },
    {
      label: 'Not yours',
      question:
        'What in that list is not yours to carry? Name it, and set it down.',
      answers: [
        {
          entryId: 'e-mo-18',
          at: '2026-09-12T06:11:00Z',
          text: "Thursday's result. I have been carrying it since August as though carrying it changes it.",
        },
        {
          entryId: 'e-mo-17',
          at: '2026-09-05T06:34:00Z',
          text: 'The budget. It is genuinely not my decision and I have been taking it personally for a month.',
        },
        {
          entryId: 'e-mo-16',
          at: '2026-08-29T06:02:00Z',
          text: 'How Ella feels about Tuesday. I can be there. I cannot make it go well for her.',
        },
        {
          entryId: 'e-mo-14',
          at: '2026-08-08T06:40:00Z',
          text: "Whether I'm any good at this. That's not a question I'm supposed to answer at 6am on a Saturday.",
        },
        {
          entryId: 'e-mo-12',
          at: '2026-07-18T06:29:00Z',
          text: "How Dan takes it. Mine is the saying. His is the taking.",
        },
        {
          entryId: 'e-mo-11',
          at: '2026-07-11T06:45:00Z',
          text: "Mum's diagnosis. Obviously. And yet.",
        },
        {
          entryId: 'e-mo-10',
          at: '2026-07-04T06:22:00Z',
          text: "The roof. It'll cost what it costs.",
        },
        {
          entryId: 'e-mo-08',
          at: '2026-06-20T06:12:00Z',
          text: "The results. I keep putting this one down and picking it up again on the way out of the room.",
        },
        {
          entryId: 'e-mo-05',
          at: '2026-05-23T06:41:00Z',
          text: "Whatever is going on with Dan that isn't about me. Which might be most of it.",
        },
        {
          entryId: 'e-mo-04',
          at: '2026-05-16T07:02:00Z',
          text: "Whether the work is the right work. Not today's question.",
        },
        {
          entryId: 'e-mo-01',
          at: '2026-04-14T06:20:00Z',
          text: "Not sure I understand this one yet.",
        },
      ],
    },
    {
      label: 'Offering',
      question: 'Take, Lord, and receive. What are you offering God for today?',
      answers: [
        {
          entryId: 'e-mo-18',
          at: '2026-09-12T06:11:00Z',
          text: 'The lunch. Take it and make me present in it.',
        },
        {
          entryId: 'e-mo-17',
          at: '2026-09-05T06:34:00Z',
          text: 'The first hour. It has been yours about twice in five months.',
        },
        {
          entryId: 'e-mo-16',
          at: '2026-08-29T06:02:00Z',
          text: 'Tuesday. Hers and yours, not mine.',
        },
        {
          entryId: 'e-mo-14',
          at: '2026-08-08T06:40:00Z',
          text: 'The conversation. And my need to come out of it looking reasonable.',
        },
        {
          entryId: 'e-mo-13',
          at: '2026-07-25T06:18:00Z',
          text: 'A quiet day. I am offering you a quiet day and that feels like a strange gift to bring.',
        },
        {
          entryId: 'e-mo-12',
          at: '2026-07-18T06:29:00Z',
          text: 'My nerve.',
        },
        {
          entryId: 'e-mo-11',
          at: '2026-07-11T06:45:00Z',
          text: 'The call with Mum. Let it be a call and not a fact-finding exercise.',
        },
        {
          entryId: 'e-mo-09',
          at: '2026-06-27T06:50:00Z',
          text: "Everything I listed, since I can't seem to put any of it down on my own.",
        },
        {
          entryId: 'e-mo-08',
          at: '2026-06-20T06:12:00Z',
          text: 'My temper at 7.40am.',
        },
        {
          entryId: 'e-mo-06',
          at: '2026-06-06T06:08:00Z',
          text: 'An ordinary Saturday. Take it, it is all I have.',
        },
        {
          entryId: 'e-mo-05',
          at: '2026-05-23T06:41:00Z',
          text: 'Every meeting with Dan today.',
        },
        {
          entryId: 'e-mo-02',
          at: '2026-04-25T06:33:00Z',
          text: 'Monday, before it happens.',
        },
        {
          entryId: 'e-mo-01',
          at: '2026-04-14T06:20:00Z',
          text: 'The hum I can’t name.',
        },
      ],
    },
  ],
}

const dailyExamen = {
  practice: 'The Daily Examen',
  walks: 11,
  firstAt: '2026-04-30T21:40:00Z',
  lastAt: '2026-09-09T22:05:00Z',
  movements: [
    {
      label: 'Gratitude',
      question: 'What am I grateful for from today — even one small thing?',
      answers: [
        {
          entryId: 'e-de-11',
          at: '2026-09-09T22:05:00Z',
          text: 'Ella laughing at something genuinely funny she said herself.',
        },
        {
          entryId: 'e-de-10',
          at: '2026-08-26T21:50:00Z',
          text: 'The walk back from the station in that light.',
        },
        {
          entryId: 'e-de-09',
          at: '2026-08-11T22:20:00Z',
          text: 'Dan was decent today. I want to write that down because I have written the opposite enough times.',
        },
        {
          entryId: 'e-de-08',
          at: '2026-07-29T21:35:00Z',
          text: 'Cold water. A good sandwich. Low bar today and that is fine.',
        },
        {
          entryId: 'e-de-07',
          at: '2026-07-14T22:12:00Z',
          text: "Mum rang me, which she hasn't done first in a long time.",
        },
        {
          entryId: 'e-de-06',
          at: '2026-06-30T21:55:00Z',
          text: 'Got through it.',
        },
        {
          entryId: 'e-de-05',
          at: '2026-06-17T22:30:00Z',
          text: 'The team meeting went well and it went well partly because I kept my mouth shut.',
        },
        {
          entryId: 'e-de-04',
          at: '2026-06-03T21:45:00Z',
          text: 'Rain on the skylight while I worked. Unreasonably pleasant.',
        },
        {
          entryId: 'e-de-03',
          at: '2026-05-19T22:00:00Z',
          text: 'Pete texted out of nowhere.',
        },
        {
          entryId: 'e-de-02',
          at: '2026-05-08T21:38:00Z',
          text: 'That the pitch is over.',
        },
        {
          entryId: 'e-de-01',
          at: '2026-04-30T21:40:00Z',
          text: 'Ella wanted me to read, not her mum. Small thing. Not a small thing.',
        },
      ],
    },
    {
      label: 'Awareness',
      question: 'Where did I feel most alive? Where most distant from God?',
      answers: [
        {
          entryId: 'e-de-11',
          at: '2026-09-09T22:05:00Z',
          text: 'Most alive on the floor with Ella. Most distant at 3pm refreshing my inbox for the ninth time.',
        },
        {
          entryId: 'e-de-10',
          at: '2026-08-26T21:50:00Z',
          text: 'Alive walking. Distant in the meeting where I performed the whole time.',
        },
        {
          entryId: 'e-de-09',
          at: '2026-08-11T22:20:00Z',
          text: 'Honestly neither, all day. Flat.',
        },
        {
          entryId: 'e-de-08',
          at: '2026-07-29T21:35:00Z',
          text: 'Alive cooking. Distant on my phone in the same hour, which tells me something.',
        },
        {
          entryId: 'e-de-07',
          at: '2026-07-14T22:12:00Z',
          text: 'Alive on the phone to Mum. Distant right after, when I went straight back to work like nothing had happened.',
        },
        {
          entryId: 'e-de-05',
          at: '2026-06-17T22:30:00Z',
          text: 'Alive listening. That keeps being the answer and I keep being surprised by it.',
        },
        {
          entryId: 'e-de-04',
          at: '2026-06-03T21:45:00Z',
          text: 'Distant the whole morning. Came back around four for no reason I can identify.',
        },
        {
          entryId: 'e-de-02',
          at: '2026-05-08T21:38:00Z',
          text: 'Alive during, empty after. I think I only feel close to God when performing and that is worth sitting with.',
        },
        {
          entryId: 'e-de-01',
          at: '2026-04-30T21:40:00Z',
          text: 'Alive at bedtime. Distant at work, but I say that every time I do this so maybe I should look at it properly.',
        },
      ],
    },
    {
      label: 'Examination',
      question: 'Was there a moment I turned away — from love, from honesty, from God?',
      answers: [
        {
          entryId: 'e-de-11',
          at: '2026-09-09T22:05:00Z',
          text: 'Snapped at Ella over the shoes. She was six minutes slow and I was already angry about something else entirely.',
        },
        {
          entryId: 'e-de-09',
          at: '2026-08-11T22:20:00Z',
          text: "Let someone else take the blame in the standup and said nothing. It took me until now to admit that's what happened.",
        },
        {
          entryId: 'e-de-07',
          at: '2026-07-14T22:12:00Z',
          text: 'Cut Mum short because I had a call. The call was not important.',
        },
        {
          entryId: 'e-de-05',
          at: '2026-06-17T22:30:00Z',
          text: "Didn't turn away today as far as I can tell. Writing that down too.",
        },
        {
          entryId: 'e-de-02',
          at: '2026-05-08T21:38:00Z',
          text: 'Overstated the numbers in the pitch. Not a lie exactly. Not honest either.',
        },
        {
          entryId: 'e-de-01',
          at: '2026-04-30T21:40:00Z',
          text: 'Scrolled for an hour instead of going to bed, which is not a sin but is not nothing.',
        },
      ],
    },
    {
      label: 'Prayer',
      question: 'What do I want to ask for tomorrow?',
      answers: [
        {
          entryId: 'e-de-11',
          at: '2026-09-09T22:05:00Z',
          text: 'Patience at 7.40am. Same as always.',
        },
        {
          entryId: 'e-de-10',
          at: '2026-08-26T21:50:00Z',
          text: 'To stop performing in meetings.',
        },
        {
          entryId: 'e-de-08',
          at: '2026-07-29T21:35:00Z',
          text: 'A quiet head.',
        },
        {
          entryId: 'e-de-07',
          at: '2026-07-14T22:12:00Z',
          text: 'Time with Mum that I am actually in.',
        },
        {
          entryId: 'e-de-05',
          at: '2026-06-17T22:30:00Z',
          text: 'More of whatever today was.',
        },
        {
          entryId: 'e-de-03',
          at: '2026-05-19T22:00:00Z',
          text: 'Courage about the Dan thing.',
        },
        {
          entryId: 'e-de-01',
          at: '2026-04-30T21:40:00Z',
          text: 'To be at home when I am at home.',
        },
      ],
    },
  ],
}

const theRound = {
  practice: 'The Round',
  walks: 7,
  firstAt: '2026-06-07T08:30:00Z',
  lastAt: '2026-09-13T08:15:00Z',
  movements: [
    {
      label: 'Family',
      question: 'What is true here this week?',
      answers: [
        {
          entryId: 'e-tr-07',
          at: '2026-09-13T08:15:00Z',
          text: 'Stretched. Mum takes most of what I have and Ella gets what is left, and Ella has noticed.',
        },
        {
          entryId: 'e-tr-06',
          at: '2026-08-30T08:40:00Z',
          text: 'Good week. Everyone in the same room on Sunday for the first time since June.',
        },
        {
          entryId: 'e-tr-05',
          at: '2026-08-16T08:22:00Z',
          text: 'Away. Easier when we are away, which is worth being honest about rather than pleased with.',
        },
        {
          entryId: 'e-tr-03',
          at: '2026-07-12T08:35:00Z',
          text: 'Tense. Mostly me.',
        },
        {
          entryId: 'e-tr-02',
          at: '2026-06-21T08:28:00Z',
          text: "Fine. Genuinely fine. I notice I don't trust 'fine'.",
        },
        {
          entryId: 'e-tr-01',
          at: '2026-06-07T08:30:00Z',
          text: 'Close, and I am taking it for granted.',
        },
      ],
    },
    {
      label: 'Work',
      question: 'What is true here this week?',
      answers: [
        {
          entryId: 'e-tr-07',
          at: '2026-09-13T08:15:00Z',
          text: 'Better since the conversation with Dan. It cost me a bad fortnight and was worth it.',
        },
        {
          entryId: 'e-tr-06',
          at: '2026-08-30T08:40:00Z',
          text: 'Braced for the review. Doing the work of three weeks in my head every night.',
        },
        {
          entryId: 'e-tr-04',
          at: '2026-07-26T08:10:00Z',
          text: 'Quiet, and I did not know what to do with myself. That is information.',
        },
        {
          entryId: 'e-tr-03',
          at: '2026-07-12T08:35:00Z',
          text: 'Dan. Still Dan. Eight weeks of this now.',
        },
        {
          entryId: 'e-tr-02',
          at: '2026-06-21T08:28:00Z',
          text: 'Heavy but the good kind.',
        },
        {
          entryId: 'e-tr-01',
          at: '2026-06-07T08:30:00Z',
          text: 'Too much of my week, and it has been for longer than I want to write down.',
        },
      ],
    },
    {
      label: 'Health',
      question: 'What is true here this week?',
      answers: [
        {
          entryId: 'e-tr-07',
          at: '2026-09-13T08:15:00Z',
          text: 'Back is worse. Still have not booked it. Five months now.',
        },
        {
          entryId: 'e-tr-05',
          at: '2026-08-16T08:22:00Z',
          text: 'Slept properly for six nights running and I am a different person.',
        },
        {
          entryId: 'e-tr-01',
          at: '2026-06-07T08:30:00Z',
          text: 'Ignoring it.',
        },
      ],
    },
    {
      label: 'Friendship',
      question: 'What is true here this week?',
      answers: [
        {
          entryId: 'e-tr-06',
          at: '2026-08-30T08:40:00Z',
          text: 'Pete. I owe him a call and I have owed it long enough that calling is now embarrassing, which is how these go.',
        },
        {
          entryId: 'e-tr-04',
          at: '2026-07-26T08:10:00Z',
          text: 'Thin. Nobody has done anything wrong.',
        },
        {
          entryId: 'e-tr-01',
          at: '2026-06-07T08:30:00Z',
          text: "Haven't thought about it in weeks, which is the answer.",
        },
      ],
    },
    {
      label: 'Church',
      question: 'What is true here this week?',
      answers: [
        {
          entryId: 'e-tr-07',
          at: '2026-09-13T08:15:00Z',
          text: 'Going through the motions and hoping nobody asks.',
        },
        {
          entryId: 'e-tr-03',
          at: '2026-07-12T08:35:00Z',
          text: 'Served, enjoyed it, came home empty. Not sure what to do with that.',
        },
        {
          entryId: 'e-tr-02',
          at: '2026-06-21T08:28:00Z',
          text: 'Good. The Thursday group especially.',
        },
      ],
    },
    {
      label: 'Money',
      question: 'What is true here this week?',
      answers: [
        {
          entryId: 'e-tr-06',
          at: '2026-08-30T08:40:00Z',
          text: 'Tight but not frightening. The boiler would make it frightening.',
        },
        {
          entryId: 'e-tr-02',
          at: '2026-06-21T08:28:00Z',
          text: 'Fine, and I still check the app four times a day.',
        },
      ],
    },
  ],
}

const lament = {
  practice: 'Psalmic Lament',
  walks: 3,
  firstAt: '2026-06-24T23:10:00Z',
  lastAt: '2026-09-03T23:40:00Z',
  movements: [
    {
      label: 'Address',
      question: 'Say who you are speaking to. Start there, even if it is hard.',
      answers: [
        {
          entryId: 'e-pl-03',
          at: '2026-09-03T23:40:00Z',
          text: "God, who I am told is near and who has been quiet since June.",
        },
        {
          entryId: 'e-pl-02',
          at: '2026-07-20T23:15:00Z',
          text: 'Lord.',
        },
        {
          entryId: 'e-pl-01',
          at: '2026-06-24T23:10:00Z',
          text: "I don't know how to start this one.",
        },
      ],
    },
    {
      label: 'Complaint',
      question: 'Say the thing plainly. No softening it for God.',
      answers: [
        {
          entryId: 'e-pl-03',
          at: '2026-09-03T23:40:00Z',
          text: "She is seventy-one and she is frightened and I am angry that this is the thing we get. I don't want it reframed. I want it not to be happening.",
        },
        {
          entryId: 'e-pl-02',
          at: '2026-07-20T23:15:00Z',
          text: 'I am tired of being the one who holds it all together and I am tired of nobody noticing that that is what I am doing.',
        },
        {
          entryId: 'e-pl-01',
          at: '2026-06-24T23:10:00Z',
          text: 'It is the waiting. The waiting is the thing.',
        },
      ],
    },
    {
      label: 'Trust',
      question: 'Is there anything you still hold to? If not, say that.',
      answers: [
        {
          entryId: 'e-pl-03',
          at: '2026-09-03T23:40:00Z',
          text: 'That you have been here before, in the other bad year. I remember it as a fact more than I feel it.',
        },
        {
          entryId: 'e-pl-01',
          at: '2026-06-24T23:10:00Z',
          text: 'Not tonight.',
        },
      ],
    },
  ],
}

const lectio = {
  practice: 'Lectio Divina',
  walks: 4,
  firstAt: '2026-05-11T06:55:00Z',
  lastAt: '2026-08-19T07:05:00Z',
  movements: [
    {
      label: 'Lectio — Read',
      question: 'What passage are you bringing? Read it slowly, twice.',
      answers: [
        { entryId: 'e-ld-04', at: '2026-08-19T07:05:00Z', text: 'Psalm 131' },
        { entryId: 'e-ld-03', at: '2026-07-07T06:48:00Z', text: 'Lamentations 3:22-23' },
        { entryId: 'e-ld-02', at: '2026-06-10T07:00:00Z', text: 'Mark 4:35-41' },
        { entryId: 'e-ld-01', at: '2026-05-11T06:55:00Z', text: 'Psalm 23' },
      ],
    },
    {
      label: 'Meditatio — Meditate',
      question: 'Repeat that word or phrase. Let it move around in you.',
      answers: [
        {
          entryId: 'e-ld-04',
          at: '2026-08-19T07:05:00Z',
          text: '"Calmed and quieted." I have not been either for months and the psalm does not seem to think that is a moral failure.',
        },
        {
          entryId: 'e-ld-03',
          at: '2026-07-07T06:48:00Z',
          text: '"New every morning." Every morning. Including the ones I ruin by nine.',
        },
        {
          entryId: 'e-ld-02',
          at: '2026-06-10T07:00:00Z',
          text: '"Do you not care." That is the line. That is my line, not the disciples’.',
        },
        {
          entryId: 'e-ld-01',
          at: '2026-05-11T06:55:00Z',
          text: '"He makes me lie down." Makes. Not invites.',
        },
      ],
    },
  ],
}

export const ARCHIVE: Archive = {
  generatedAt: '2026-09-15T00:00:00Z',
  entries: 412,
  threads: [morningOffering, dailyExamen, theRound, lament, lectio],
}
