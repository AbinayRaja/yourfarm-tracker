import { Platform } from 'react-native';
import { PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return true;
  }

  // Android
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'This app needs access to your location for check-in.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn(err);
    return false;
  }
};

// ────────────────────────────────────────────────
export const fetchLocation = (): Promise<Geolocation.GeoCoordinates> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => {
        console.log('Geolocation error:', error);
        reject(error);
      },
      {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 10000,
        distanceFilter: 0,
      }
    );
  });



export const getAddressFromCoords = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  try {
    const response = await fetch(
      `https://test.yourfarm.co.in/v1/admin/address/coordinates?latitude=${latitude}&longitude=${longitude}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: '7KIAIMQZ25XTQMM7XIYWA',
        },
      }
    );

    if (!response.ok) {
      return 'Could not fetch address';
    }

    const json = await response.json();
    console.log(json, 'json');

    // const { suburb, city_district, city } = json?.data || {};

    // const parts = [suburb, city_district, city].filter(
    //   (item) => item && item.trim()
    // );

    return json;;
  } catch {
    return 'Could not fetch address';
  }
};


let trackingInterval: NodeJS.Timeout | null = null;

export const startTracking = (
  onNewLocation: (coords: Geolocation.GeoCoordinates, timestamp: string) => void
): (() => void) => {
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }

  trackingInterval = setInterval(async () => {
    try {
      const position = await fetchLocation();
      onNewLocation(position, new Date().toISOString());
    } catch (err) {
      console.log('Track location failed:', err);
    }
  }, 4 * 60 * 1000); // ← 4 minutes — change to 2*60*1000 or 5*60*1000 as needed

  return () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }
  };
};

export const stopTracking = () => {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
};