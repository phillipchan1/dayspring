export type KeepingEmotion =
  | 'joy'
  | 'peace'
  | 'gratitude'
  | 'hope'
  | 'love'
  | 'longing'
  | 'sadness'
  | 'grief'
  | 'fear'
  | 'anger'
  | 'shame'
  | 'confusion'
  | 'weariness'

export interface KeepingSentiment {
  present: boolean
  valence: number
  activation: number
  confidence: number
  emotions: Array<{ emotion: KeepingEmotion; intensity: number }>
}

export interface KeepingIngredient {
  kind: 'story' | 'learning' | 'change'
  quote: string
  confidence: number
}

export interface KeepingMovement {
  id: string
  quote: string
  charStart: number
  charEnd: number
  subjects: Array<{
    key: string
    label: string
    kind: 'person' | 'place' | 'domain' | 'matter'
  }>
  sentiment: KeepingSentiment
  ingredients: KeepingIngredient[]
}

export interface KeepingEntryReading {
  version: string
  entryId: string
  truncated: boolean
  sentiment: KeepingSentiment
  movements: KeepingMovement[]
}
