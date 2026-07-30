/* Mi Reseller Program — Google Maps location picker
   Lets a reseller drop/drag a pin on a map to select their location. */
import { GOOGLE_MAPS_KEY } from './config.js';

let loaderPromise = null;

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_KEY || GOOGLE_MAPS_KEY.startsWith('YOUR_')) {
      reject(new Error('Google Maps API key set nahi hui (js/config.js → GOOGLE_MAPS_KEY)'));
      return;
    }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&callback=__miMapsReady`;
    s.async = true; s.defer = true;
    window.__miMapsReady = () => resolve();
    s.onerror = () => reject(new Error('Google Maps load nahi ho saka'));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

/**
 * Mount an interactive map picker inside `container`.
 * @param {HTMLElement} container
 * @param {{lat:number,lng:number}} [initial]
 * @param {(pos:{lat:number,lng:number,address:string})=>void} onChange
 */
export async function mountLocationPicker(container, initial, onChange) {
  const addrBox = document.createElement('div');
  addrBox.className = 'map-addr';
  addrBox.textContent = '📍 Map load ho raha he...';

  try {
    await loadGoogleMaps();
  } catch (e) {
    container.innerHTML = `<div class="map-addr" style="color:var(--r)">⚠️ ${e.message}</div>`;
    return null;
  }

  const start = initial || { lat: 31.1181, lng: 74.4489 }; // Kasur, Punjab default
  const map = new google.maps.Map(container, {
    center: start, zoom: 13, disableDefaultUI: false, streetViewControl: false,
    mapTypeControl: false, fullscreenControl: false,
    styles: [{ elementType: 'geometry', stylers: [{ color: '#0e1a10' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#0e1a10' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#8bf06a' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1f3320' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#04150a' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] }]
  });
  const marker = new google.maps.Marker({ position: start, map, draggable: true, title: 'Aapki Location' });
  const geocoder = new google.maps.Geocoder();

  container.parentElement?.appendChild(addrBox);

  async function updateAddress(pos) {
    addrBox.textContent = '📍 Address dhoond rahe hain...';
    try {
      const res = await geocoder.geocode({ location: pos });
      const address = res.results?.[0]?.formatted_address || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
      addrBox.textContent = '📍 ' + address;
      onChange?.({ lat: pos.lat, lng: pos.lng, address });
    } catch (e) {
      const address = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
      addrBox.textContent = '📍 ' + address;
      onChange?.({ lat: pos.lat, lng: pos.lng, address });
    }
  }

  marker.addListener('dragend', () => {
    const p = marker.getPosition();
    playSound?.('click');
    updateAddress({ lat: p.lat(), lng: p.lng() });
  });
  map.addListener('click', (e) => {
    marker.setPosition(e.latLng);
    playSound?.('click');
    updateAddress({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  });

  // Try to center on the user's real location if permitted
  if (!initial && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setCenter(p); marker.setPosition(p); updateAddress(p);
    }, () => { updateAddress(start); }, { timeout: 5000 });
  } else {
    updateAddress(start);
  }

  return {
    map, marker,
    /** Move the map+marker to a given {lat,lng} programmatically (e.g. after GPS lookup). */
    setPosition(pos) { map.setCenter(pos); marker.setPosition(pos); updateAddress(pos); }
  };
}

/**
 * Direct GPS location — asks the browser for the device's real coordinates
 * (no map needed) and reverse-geocodes them into a readable address.
 * Works with or without the Maps picker being open.
 * @returns {Promise<{lat:number,lng:number,address:string}>}
 */
export function getGPSLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Is device/browser me GPS support nahi he')); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        await loadGoogleMaps();
        const geocoder = new google.maps.Geocoder();
        const res = await geocoder.geocode({ location: p });
        const address = res.results?.[0]?.formatted_address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
        resolve({ lat: p.lat, lng: p.lng, address });
      } catch (e) {
        // Maps key missing/unavailable — still return raw coordinates, GPS itself worked.
        resolve({ lat: p.lat, lng: p.lng, address: `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` });
      }
    }, (err) => {
      const msgs = { 1: 'Location permission deny ki gayi. Browser settings se allow karein.', 2: 'Location abhi available nahi.', 3: 'GPS lookup timeout ho gaya, dobara try karein.' };
      reject(new Error(msgs[err.code] || 'GPS location nahi mil saki.'));
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
}
