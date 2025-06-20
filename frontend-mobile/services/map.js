// services/map.js
import MapboxGL from '@rnmapbox/maps';
import { APP_CONFIG } from '../config/app-config';

// Configure Mapbox globalement
MapboxGL.setAccessToken(APP_CONFIG.MAPBOX_API_KEY);

export { MapboxGL };