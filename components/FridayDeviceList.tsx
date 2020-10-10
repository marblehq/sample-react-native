import {parseManufacturerData, stringToByteArray} from '@fridayhome/messages';
import {decode} from 'base-64';
import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {BleManager, State} from 'react-native-ble-plx';
import {FridayDevice} from '../src/FridayDevice';

export const FridayDeviceList = () => {
  const manager = useMemo(() => new BleManager(), []);
  const [devices, setDevices] = useState<FridayDevice[]>([]);

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

          const bytes = base64ToBytes(device.manufacturerData);
          const manufacturerData = parseManufacturerData(bytes);

          if (!manufacturerData?.isFriday) {
            return;
          }
          console.debug(bytes);
          console.log(manufacturerData.manufacturerId);

          const fridayDevice = device as FridayDevice;
          fridayDevice.friday = manufacturerData;

          setDevices((ds) =>
            ds
              .filter(
                (x) =>
                  x.friday.manufacturerId !==
                  fridayDevice.friday.manufacturerId,
              )
              .concat([fridayDevice]),
          );
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
        <Text key={i} style={styles.device}>
          {x.name}
        </Text>
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
  device: {
    paddingVertical: 10,
  },
});

function base64ToBytes(str?: string | null): number[] {
  if (!str) {
    return [];
  }
  return stringToByteArray(decode(str));
}
