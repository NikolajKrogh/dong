/**
 * Gun.js Integration Test Component
 * 
 * This component validates that Gun.js is properly configured and working.
 * It tests basic read/write operations and displays the connection status.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import gun, { testGunConnection } from '../utils/gunConfig';

export const GunTestComponent = () => {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'failed'>('testing');
  const [testData, setTestData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Test connection on mount
    runConnectionTest();
  }, []);

  const runConnectionTest = async () => {
    setConnectionStatus('testing');
    setLoading(true);
    
    const result = await testGunConnection();
    
    setConnectionStatus(result ? 'connected' : 'failed');
    setLoading(false);
  };

  const writeTestData = () => {
    setLoading(true);
    const data = {
      message: 'Test message',
      timestamp: Date.now(),
      random: Math.random(),
    };

    gun.get('dong_test').put(data, (ack: any) => {
      if (ack.err) {
        console.error('Write failed:', ack.err);
      } else {
        console.log('✅ Data written successfully');
      }
      setLoading(false);
    });
  };

  const readTestData = () => {
    setLoading(true);
    gun.get('dong_test').once((data: any) => {
      setTestData(data);
      setLoading(false);
      console.log('📖 Data read:', data);
    });
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#4CAF50';
      case 'failed':
        return '#F44336';
      default:
        return '#FFC107';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return '✅ Gun.js Connected';
      case 'failed':
        return '❌ Connection Failed';
      default:
        return '⏳ Testing Connection...';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gun.js Integration Test</Text>
      
      <View style={[styles.statusCard, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

      {loading && <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />}

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={runConnectionTest}
          disabled={loading}
        >
          <Text style={styles.buttonText}>🔄 Test Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={writeTestData}
          disabled={loading || connectionStatus !== 'connected'}
        >
          <Text style={styles.buttonText}>✍️ Write Data</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={readTestData}
          disabled={loading || connectionStatus !== 'connected'}
        >
          <Text style={styles.buttonText}>📖 Read Data</Text>
        </TouchableOpacity>
      </View>

      {testData && (
        <View style={styles.dataCard}>
          <Text style={styles.dataTitle}>Latest Data:</Text>
          <Text style={styles.dataText}>{JSON.stringify(testData, null, 2)}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    marginVertical: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dataCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dataText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default GunTestComponent;
