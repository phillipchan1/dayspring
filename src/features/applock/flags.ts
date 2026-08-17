// Kill switch for the app lock, mirroring the shape of
// features/onboarding/flags.ts.
//
// Deliberately NOT a `profiles.feature_flags` entry: the gate runs above the
// point where those load, so reading one would mean a network round trip in
// front of every launch — the exact cost the local mirror exists to avoid.
//
// Default ON, because the feature is already opt-in per user: nobody sees a lock
// until they set a PIN, so shipping it dark would only hide it from the person
// who went looking for it. What this switch is really for is the other
// direction. Every other feature fails by not appearing; this one fails by
// standing between someone and their own journal. `VITE_FF_APP_LOCK=false`
// disables the gate in one build without a code change, which is worth having
// before we need it.
export const APP_LOCK_ENABLED = import.meta.env.VITE_FF_APP_LOCK !== 'false'
