import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  requestLocationPermission,
  fetchLocation,
  getAddressFromCoords,
} from '../helpers/locationHelper';
import styles from '../styles/checkinStyles';
import CheckIn from '../assets/checkinMap.jpg';
import {calculateTimeDifference,calculateDistanceKm} from '../helpers/calculateKm'
// Storage key
const CHECKIN_HISTORY_KEY = '@checkin_history';

interface CheckRecord {
  type: 'check-in' | 'check-out';
  timestamp: string;
  address: string;
  coords: {
    latitude: number;
    longitude: number;
  };
}


const Checkin = ({route}) => {
   const { userName } = route.params;
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [latestRecord, setLatestRecord] = useState<CheckRecord | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<CheckRecord | null>(null);
  const [lastCheckOut, setLastCheckOut] = useState<CheckRecord | null>(null);
  const [sessionStats, setSessionStats] = useState<{
    hours: number;
    minutes: number;
    distanceKm: number;
  } | null>(null);
  const [displayAddress, setDisplayAddress] = useState<string>('No location yet');

  useEffect(() => {
    loadLatestCheckRecord();
  }, []);

  const loadLatestCheckRecord = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(CHECKIN_HISTORY_KEY);
      if (jsonValue) {
        const history: CheckRecord[] = JSON.parse(jsonValue);
        if (history.length > 0) {
          const latest = history[history.length - 1];
          setLatestRecord(latest);
          setDisplayAddress(latest.address);
          let checkIn: CheckRecord | null = null;
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].type === 'check-in') {
              checkIn = history[i];
              break;
            }
          }
          setLastCheckIn(checkIn);
          setLastCheckOut(null);
          setSessionStats(null);
        }
      }
    } catch (e) {
      console.error('Failed to l oad history:', e);
    }
  };

  const saveCheckRecord = async (record: CheckRecord) => {
    try {
      const jsonValue = await AsyncStorage.getItem(CHECKIN_HISTORY_KEY);
      let history: CheckRecord[] = jsonValue ? JSON.parse(jsonValue) : [];
      history.push(record);
      if (history.length > 20) history = history.slice(-20);
      await AsyncStorage.setItem(CHECKIN_HISTORY_KEY, JSON.stringify(history));

      setLatestRecord(record);
      setDisplayAddress(record.address);

      if (record.type === 'check-in') {
        setLastCheckIn(record);
        setLastCheckOut(null);
        setSessionStats(null); 
      } else {
        setLastCheckOut(record);

        if (lastCheckIn) {
          const timeDiff = calculateTimeDifference(
            lastCheckIn.timestamp,
            record.timestamp
          );
          const distance = calculateDistanceKm(
            lastCheckIn.coords.latitude,
            lastCheckIn.coords.longitude,
            record.coords.latitude,
            record.coords.longitude
          );

          setSessionStats({
            hours: timeDiff.hours,
            minutes: timeDiff.minutes,
            distanceKm: distance,
          });
        }
      }
    } catch (e) {
      console.error('Failed to save record:', e);
    }
  };

  const handleAction = async (action: 'check-in' | 'check-out') => {
    setLoading(true);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const coords = await fetchLocation();
      const response = await getAddressFromCoords(coords.latitude, coords.longitude);
      // const response = await getAddressFromCoords(11.071524, 77.104763);

      let fullAddress = 'Could not get address';

      if (response && typeof response === 'object' && 'data' in response && response.data) {
        const { suburb = '', city_district = '', city = '' } = response.data;
        const parts = [suburb, city_district, city].filter(Boolean);
        if (parts.length > 0) {
          fullAddress = parts.join(', ');
        }
      }

      const newRecord: CheckRecord = {
        type: action,
        timestamp: new Date().toISOString(),
        address: fullAddress,
        coords: {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
      };

      await saveCheckRecord(newRecord);

      Alert.alert(
        `${action === 'check-in' ? 'Check-in' : 'Check-out'} Successful`,
        `📍 ${fullAddress}\n\n${new Date().toLocaleString('en-IN')}`
      );
    } catch (err: any) {
      console.error('Action failed:', err);
      Alert.alert('Error', err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const isLastCheckIn = latestRecord?.type === 'check-in';
  const nextAction = isLastCheckIn ? 'check-out' : 'check-in';
  const buttonText = loading ? 'PROCESSING...' : nextAction === 'check-in' ? 'CHECK-IN' : 'CHECK-OUT';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Check In</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.welcome}>Welcome, {userName}!</Text>
            <Text style={styles.subText}>Sales Officer</Text>
          </View>
        </View>

        <Image source={CheckIn} style={styles.map} />

        <View style={styles.locationRow}>
          <Text style={styles.locationText}>Location</Text>
          <Text style={styles.dayText}>{displayAddress}</Text>
        </View>

        {/* Records + Stats Section */}
        {lastCheckIn ? (
          <>
            {/* Check-in Card - always visible if exists */}
            <View
              style={{
                marginVertical: 12,
                padding: 12,
                backgroundColor: '#f0fdf4',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#86efac',
              }}
            >
              <Text style={{ fontWeight: 'bold', color: '#15803d' }}>
                Checked In
              </Text>
              <Text style={{ color: '#4b5563', marginTop: 4, fontSize: 13 }}>
                {new Date(lastCheckIn.timestamp).toLocaleString('en-IN')}
              </Text>
              <Text style={{ marginTop: 6, color: '#374151' }}>
                📍 {lastCheckIn.address || 'Location not available'}
              </Text>
            </View>

            {/* Check-out Card + Session Stats - only after check-out in this session */}
            {lastCheckOut && (
              <View
                style={{
                  marginVertical: 12,
                  padding: 12,
                  backgroundColor: '#fef2f2',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#fca5a5',
                }}
              >
                <Text style={{ fontWeight: 'bold', color: '#b91c1c', fontSize: 16 }}>
                  Checked Out
                </Text>

                <Text style={{ color: '#4b5563', marginTop: 4, fontSize: 13 }}>
                  {new Date(lastCheckOut.timestamp).toLocaleString('en-IN')}
                </Text>

                <Text style={{ marginTop: 6, color: '#374151' }}>
                  📍 {lastCheckOut.address || 'Location not available'}
                </Text>

                {sessionStats && (
                  <View
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: '#fecaca',
                    }}
                  >
                    <Text style={{ color: '#1b3a99', fontWeight: '600', fontSize: 15 }}>
                      Session Summary
                    </Text>
                    <Text style={{ color: '#374151', marginTop: 6, fontSize: 14 }}>
                      ⏱ Duration: {sessionStats.hours} hrs {sessionStats.minutes} min
                    </Text>
                    <Text style={{ color: '#374151', marginTop: 4, fontSize: 14 }}>
                      🛣 Distance travelled: {sessionStats.distanceKm} km
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          <Text style={{ textAlign: 'center', color: '#6b7280', marginVertical: 16 }}>
            No Check-in yet
          </Text>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.checkInBtn,
            nextAction === 'check-out' && { backgroundColor: '#b91c1c' },
          ]}
          onPress={() => handleAction(nextAction)}
          disabled={loading}
        >
          <Text style={styles.checkInText}>{buttonText}</Text>
        </TouchableOpacity>

        <Text style={styles.signalText}>
          {loading ? 'Getting location...' : ''}
        </Text>
      </View>
    </View>
  );
};

export default Checkin;