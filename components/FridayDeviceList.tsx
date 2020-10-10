import {
  BasicInfoRequest,
  DeviceType,
  Envelope,
  KnownKeyIDs,
  parseManufacturerData,
  ProtocolV1,
} from '@fridayhome/messages';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {BleManager, State} from 'react-native-ble-plx';
import {FridayDevice} from '../src/FridayDevice';
import {base64ToBytes} from '../src/utils';

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

          const manufacturerData = parseManufacturerData(
            base64ToBytes(device.manufacturerData),
          );

          if (!manufacturerData?.isFriday) {
            return;
          }
          console.log(`Discovered ${manufacturerData.manufacturerId}`);

          const fridayDevice = new FridayDevice(device, manufacturerData);

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

  const send = useCallback(
    (fridayDevice: FridayDevice) => () => {
      fridayDevice.device.connect().then(() => {
        console.log(`Connected to ${fridayDevice.friday.manufacturerId}`);
        fridayDevice.device.discoverAllServicesAndCharacteristics().then(() => {
          fridayDevice.monitorUno();
          const message = new BasicInfoRequest(
            new ProtocolV1(1, new Date(Date.now())),
          );
          const envelope = new Envelope(KnownKeyIDs.NoKeyID, message);
          fridayDevice.sendUno(envelope.toBytes());
        });
      });
    },
    [],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>List of Friday devices</Text>
      {devices.map((device, i) => (
        <Text key={i} style={styles.device} onPress={send(device)}>
          {DeviceType[device.friday.type]} - {device.friday.manufacturerId}
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
