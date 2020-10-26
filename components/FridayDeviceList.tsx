import {
	BasicInfoRequest,
	DeviceType,
	Encryption,
	Envelope,
	KnownKeyIDs,
	parseManufacturerData,
	ProtocolV1,
	LockOperation,
} from '@fridayhome/sdk';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { BleManager, State } from 'react-native-ble-plx';
import { Encryptor } from '../src/Encryptor';
import { FridayDevice } from '../src/FridayDevice';
import Base64 from 'base64-js';
import { keyPair } from '../src/constants';

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

	return (
		<View style={styles.container}>
			<Text style={styles.title}>List of Friday devices</Text>
			{devices.map((device, i) => (
				<DeviceItem key={i} device={device} />
			))}
		</View>
	);
};

const DeviceItem = (props: { device: FridayDevice }) => {
	const { device } = props;

	const unlock = useCallback(() => device.operate(LockOperation.Unlock), [
		device,
	]);
	const lock = useCallback(() => device.operate(LockOperation.Lock), [device]);

	return (
		<View style={styles.deviceContainer}>
			<Button title="Unlock" onPress={unlock} />
			<Text style={styles.device}>
				{DeviceType[device.friday.type]} - {device.friday.manufacturerId}
			</Text>
			<Button title="Lock" onPress={lock} />
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
	deviceContainer: {
		display: 'flex',
		flexDirection: 'row',
		justifyContent: 'space-evenly',
	},
});
