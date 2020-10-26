import {
	BasicInfoRequest,
	DeviceType,
	Encryption,
	Envelope,
	KnownKeyIDs,
	parseManufacturerData,
	ProtocolV1,
} from '@fridayhome/sdk';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';
import { Encryptor } from '../src/Encryptor';
import { FridayDevice } from '../src/FridayDevice';
import Base64 from 'base64-js';

export const FridayDeviceList = () => {
	const manager = useMemo(() => new BleManager(), []);
	const [devices, setDevices] = useState<FridayDevice[]>([]);

	useEffect(() => {
		Encryption.setEncryptor(Encryptor);
		manager.onStateChange((state) => {
			if (state === State.PoweredOn) {
				manager.startDeviceScan(null, null, (err, device) => {
					if (err) {
						console.error(err);
						return;
					}
					if (!device || !device.manufacturerData) {
						return;
					}

					const bytes = Base64.toByteArray(device.manufacturerData);
					const manufacturerData = parseManufacturerData(bytes);

					if (!manufacturerData?.isFriday) {
						return;
					}

					const fridayDevice = new FridayDevice(device, manufacturerData);

					setDevices((ds) =>
						ds
							.filter(
								(x) =>
									x.friday.manufacturerId !== fridayDevice.friday.manufacturerId
							)
							.concat([fridayDevice])
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
						new ProtocolV1(1, new Date(Date.now()))
					);
					const envelope = new Envelope(KnownKeyIDs.NoKeyID, message);
					fridayDevice.sendUno(envelope.toBytes());
				});
			});
		},
		[]
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
