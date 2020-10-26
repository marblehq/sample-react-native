import {
	Advertisement,
	Characteristics,
	MessageFactory,
	Services,
	IMessage,
	BasicInfoResponse,
	BitConverter,
	KnownKeyIDs,
	Encryption,
	BasicInfoRequest,
	ProtocolV1,
	Envelope,
} from '@fridayhome/sdk';
import { encode } from 'base-64';
import { Device } from 'react-native-ble-plx';
import Base64 from 'base64-js';
import { keyPair } from './constants';

export class FridayDevice {
	device: Device;
	friday: Advertisement;
	publicKey?: Uint8Array;

	constructor(device: Device, advertisement: Advertisement) {
		this.device = device;
		this.friday = advertisement;
	}

	public async connect(): Promise<void> {
		await this.device.connect();
		console.log(`Connected to ${this.friday.manufacturerId}`);
		await this.device.discoverAllServicesAndCharacteristics();
		this.monitorUno();

		// NOTE: We request the basic info from the lock here on every connect. This is data is mostly static, and should be cached between connection
		const message = new BasicInfoRequest(
			new ProtocolV1(1, new Date(Date.now()))
		);
		const envelope = new Envelope(KnownKeyIDs.NoKeyID, message);
		this.sendUno(envelope.toBytes());
	}

	public sendUno(bytes: Uint8Array) {
		console.debug(`Sending to ${this.friday.manufacturerId}: ${bytes}`);
		const str = Array.prototype.map
			.call(bytes, (x) => String.fromCharCode(x))
			.join('');
		const value = encode(str);

		this.device
			.writeCharacteristicWithoutResponseForService(
				Services.UnoPrimary,
				Characteristics.UnoRx,
				value
			)
			.catch((err) => console.warn(err));
	}

	public monitorUno() {
		this.device.monitorCharacteristicForService(
			Services.UnoPrimary,
			Characteristics.UnoTx,
			async (err, char) => {
				if (err) {
					console.warn(err);
					return;
				}

				if (!char?.value) {
					return;
				}

				// TODO: Messages are sent in 20 bytes chunks. iOS handles this for us, but Android does not. We will have to implement a `ChunkCollector` before it works on Android.
				const bytes = Base64.toByteArray(char.value);
				try {
					const keyId = BitConverter.toInt16(bytes, 2);
					let body = bytes.slice(4);
					if (this.isEncrypted(keyId)) {
						body = await Encryption.decrypt(
							body,
							keyPair.privateKey,
							this.publicKey!
						);
					}

					const message = MessageFactory.parse(body);

					this.handleMessage(message);
				} catch (ex) {
					console.warn(bytes);
					console.warn(ex);
				}
			}
		);
	}

	private isEncrypted(keyId: number) {
		return (
			keyId > KnownKeyIDs.ServerKey && keyId < KnownKeyIDs.HomeKitEnterSetup
		);
	}

	public printAllServicesAndCharacteristics() {
		this.device.services().then((ss) =>
			ss.forEach((s) => {
				s.characteristics().then((cs) => {
					console.debug(`Service: ${s.uuid}`);
					cs.forEach((c) => {
						console.debug(
							`Characteristic ${c.uuid} IsNotifiable: ${c.isNotifiable}`
						);
					});
				});
			})
		);
	}

	private handleMessage(message: IMessage) {
		if (message instanceof BasicInfoResponse) {
			console.trace('basic info received');
			this.publicKey = message.publicKey;
		} else {
			console.debug(message);
		}
	}
}
