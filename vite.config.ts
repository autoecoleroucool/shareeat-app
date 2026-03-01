import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['leaflet'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
            return 'vendor';
          }
          if (id.includes('node_modules/@supabase') || id.includes('node_modules/ws') || id.includes('node_modules/isows')) {
            return 'supabase';
          }
          if (id.includes('node_modules/leaflet')) {
            return 'leaflet';
          }
          if (id.includes('/screens/CulinaryScreen') || id.includes('/components/culinary/')) {
            return 'culinary';
          }
          if (id.includes('/screens/MapScreen') || id.includes('/hooks/useMapBoundsFetch')) {
            return 'map';
          }
          if (id.includes('/screens/MessagesScreen')) {
            return 'messages';
          }
        },
      },
    },
  },
});
