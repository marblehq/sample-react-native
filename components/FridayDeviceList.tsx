import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {BleManager, Device, State} from 'react-native-ble-plx';
import {byteArrayToHex, stringToByteArray} from '@fridayhome/messages';
import {decode} from 'base-64';

export const FridayDeviceList = () => {
  const manager = useMemo(() => new BleManager(), []);
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        console.log('power is on');
        manager.startDeviceScan(null, null, (err, device) => {
          if (err) {
            console.error(err);
            return;
          }
          if (!device || !device.manufacturerData) {
            return;
          }

          if (!device.name?.startsWith('Friday Lock')) {
            return;
          }

          console.log(device.manufacturerData);
          const data: string = decode(device.manufacturerData);
          const bytes: number[] = stringToByteArray(data);

          console.log(device.name);
          console.log(bytes);
          console.log(byteArrayToHex(bytes));

          // 00-07-02-69-D3-8E-B8
          // B8-8E-D3-69-02-07-00

          setDevices((ds) => [device]);
        });
      } else {
        console.log(`State is ${state}`);
      }
    });
  }, [manager, setDevices]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>List of Friday devices</Text>
      {devices.map((x, i) => (
        <Text key={i}>{x.name}</Text>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 24,
  },
});
