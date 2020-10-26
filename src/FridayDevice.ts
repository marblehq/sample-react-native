import {
	Advertisement,
	Characteristics,
	MessageFactory,
	Services,
	IMessage,
	BasicInfoResponse,
} from '@fridayhome/sdk';
import { encode } from 'base-64';
import { Device } from 'react-native-ble-plx';
import Base64 from 'base64-js';

export class FridayDevice {
	device: Device;
	friday: Advertisement;
	publicKey?: Uint8Array;

	constructor(device: Device, advertisement: Advertisement) {
		this.device = device;
		this.friday = advertisement;
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
			(err, char) => {
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
					const message = MessageFactory.parse(bytes.slice(4));
					this.handleMessage(message);
				} catch (ex) {
					console.warn(bytes);
					console.warn(ex);
				}
			}
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
