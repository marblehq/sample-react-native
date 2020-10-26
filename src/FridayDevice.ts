import {
	Advertisement,
	BasicInfoResponse,
	BitConverter,
	ChallengeRequest,
	Characteristics,
	CommandResponse,
	CommandResponseStatus,
	Encryption,
	Envelope,
	IMessage,
	IProtocol,
	KnownKeyIDs,
	MessageFactory,
	ProtocolV1,
	ProtocolV2,
	Services,
} from '@fridayhome/sdk';
import { encode } from 'base-64';
import Base64 from 'base64-js';
import { Device } from 'react-native-ble-plx';
import { keyPair } from './constants';

export class FridayDevice {
	device: Device;
	friday: Advertisement;
	publicKey?: Uint8Array;
	sequenceNumber = 0;

	constructor(device: Device, advertisement: Advertisement) {
		this.device = device;
		this.friday = advertisement;
	}

	public async connect(): Promise<void> {
		if (await this.device.isConnected()) {
			return;
		}
		await this.device.connect();
		console.log(`Connected to ${this.friday.manufacturerId}`);
		await this.device.discoverAllServicesAndCharacteristics();
		this.monitorUno();
	}

	public getChallenge(): Promise<Uint8Array> {
		return new Promise(async (resolve, reject) => {
			const message = new ChallengeRequest(
				new ProtocolV2(this.sequenceNumber + 1)
			);
			const envelope = new Envelope(100, message);
			this.device.monitorCharacteristicForService(
				Services.UnoPrimary,
				Characteristics.UnoTx,
				async (err, char) => {
					if (err) {
						console.error(err);
						return;
					}
					if (!char?.value) {
						return;
					}
					const response = await this.parseData(char.value);
					if (response && response.header.protocol instanceof ProtocolV2) {
						this.handleProtocol(response.header.protocol);
						resolve(response.header.protocol.challenge);
					} else {
						reject();
					}
				}
			);

			this.sendUno(
				await envelope.toEncryptedBytes(keyPair.privateKey, this.publicKey!)
			);
		});
	}

	public sendUno(bytes: Uint8Array) {
		console.debug(
			`Sending to ${this.friday.manufacturerId}: ${bytes.slice(0, 10)}`
		);
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

				const message = await this.parseData(char.value);
				if (message) {
					this.handleMessage(message);
				}
			}
		);
	}

	private async parseData(data: string): Promise<IMessage | undefined> {
		// TODO: Messages are sent in 20 bytes chunks. iOS handles this for us, but Android does not. We will have to implement a `ChunkCollector` before it works on Android.
		const bytes = Base64.toByteArray(data);
		console.trace('Received message');
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

			return MessageFactory.parse(body);
		} catch (ex) {
			console.warn(ex);
		}

		return;
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
		this.handleProtocol(message.header.protocol);

		if (message instanceof BasicInfoResponse) {
			this.publicKey = message.publicKey;
		} else if (message instanceof CommandResponse) {
			if (message.status !== CommandResponseStatus.Success) {
				console.warn(`Command status ${message.status}`);
			}
		} else {
			console.warn(`Unhandled message ${message.header.messageType}`);
		}
	}

	private handleProtocol(protocol: IProtocol) {
		if (protocol instanceof ProtocolV1) {
			this.sequenceNumber = protocol.sequenceNumber;
		} else if (protocol instanceof ProtocolV2) {
			this.sequenceNumber = protocol.sequenceNumber;
		}
	}
}
