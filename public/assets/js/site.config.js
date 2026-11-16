// Settings the team edits before the public launch.
export const SITE = {
  // Shown in the Privacy Notice as the place to ask for deletion. Put a real team address here.
  // Left empty on purpose: we do not invent contact details.
  contactEmail: '',
  // Optional Google sign-in and cloud sync (Supabase). Both values are public by design:
  // the publishable key is safe in a browser because Row Level Security limits every table to its owner.
  supabase: {
    url: 'https://mfgkvclicvcziappclua.supabase.co',
    key: 'sb_publishable_r3k8PsUA9ITqN09Mtubm2g_FNpPggxA',
  },
};
