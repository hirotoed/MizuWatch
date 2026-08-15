interface ImportMetaEnv {
  readonly MODE: 'development' | 'production';
  readonly VITE_GMAPS_API_KEY?: string;
  readonly VITE_VEHICLE_DATA_SOURCE?: 'mock' | 'supabase';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
