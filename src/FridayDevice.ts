import {
	Advertisement,
	BasicInfoRequest,
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
	LockOperation,
	LockUnlockStateMessage,
	MessageFactory,
	ProtocolV1,
	ProtocolV2,
	Services,
	MessageType,
} from '@fridayhome/sdk';
import { encode } from 'base-64';
import Base64 from 'base64-js';
import { Device, Subscription } from 'react-native-ble-plx';
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
	}

	/**
	 * Operate (lock/unlock) a lock.
	 *
	 * This works be retreiving a one-time challenge from the lock,
	 * then creating a message with a protocol with the retrieved challenge,
	 * which is then encrypted and transmitted to the lock.
	 */
	public async operate(operation: LockOperation): Promise<void> {
		await this.connect();
		// Get the basic information from the lock, which is required for sending encrypted messages
		await this.getBasicInfo();
		// Get a one-time challenge from the lock to use for the operation
		const challenge = await this.getChallenge();

		// Listen for a response
		const sub = this.monitorUno((message) => {
			if (message instanceof CommandResponse) {
				if (message.status === CommandResponseStatus.Success) {
					console.info('Lock was operated successfully');
				} else {
					console.warn(
						`Error when trying to operate lock: ${
							CommandResponseStatus[message.status]
						}`
					);
				}
				// Always disconnect when finished communicating with the lock, to allow other clients to see and connect to the lock.
				this.device.cancelConnection();
				sub.remove();
			}
		});

		// Create message, wrap it in an envelope, encrypt and send!
		const message = new LockUnlockStateMessage(
			new ProtocolV2(this.sequenceNumber, challenge),
			operation,
			new Date()
		);
		const envelope = new Envelope(100, message);
		this.sendUno(
			await envelope.toEncryptedBytes(keyPair.privateKey, this.publicKey!)
		);
	}

	/**
	 * Transmit data to the Uno lock
	 */
	public sendUno(bytes: Uint8Array) {
		console.trace(`Sending message to ${this.friday.manufacturerId}`);
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

	public monitorUno(onMessage: (message: IMessage) => void): Subscription {
		return this.device.monitorCharacteristicForService(
			Services.UnoPrimary,
			Characteristics.UnoTx,
			async (err, char) => {
				if (err || !char?.value) {
					console.warn(err);
					return;
				}

				const message = await this.parseData(char.value);
				if (message) {
					this.handleMessage(message);
					onMessage(message);
				}
			}
		);
	}

	private async parseData(data: string): Promise<IMessage | undefined> {
		// TODO: Messages are sent in 20 bytes chunks. iOS handles this for us, but Android does not. We will have to implement a `ChunkCollector` before it works on Android.
		const bytes = Base64.toByteArray(data);
		try {
			const keyId = BitConverter.toInt16(bytes, 2);
			let body = bytes.slice(4);
			if (this.isEncrypted(keyId)) {
				try {
					body = await Encryption.decrypt(
						body,
						keyPair.privateKey,
						this.publicKey!
					);
				} catch {
					console.warn(
						'Unable to decrypt message from lock. This is likely because the encryption key pair in this application does not match the key pair used to setup the lock'
					);
					return;
				}
			}
			console.trace(`${MessageType[BitConverter.toInt16(body, 2)]} received`);

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

	/**
	 * Retreive the basic info from the lock.
	 * This will be sat on `this` object.
	 */
	private getBasicInfo(): Promise<void> {
		return new Promise(async (resolve) => {
			const sub = this.monitorUno((message) => {
				if (message instanceof BasicInfoResponse) {
					this.publicKey = message.publicKey;
					sub.remove();
					resolve();
				}
			});

			await this.connect();
			const message = new BasicInfoRequest(
				new ProtocolV1(1, new Date(Date.now()))
			);
			const envelope = new Envelope(KnownKeyIDs.NoKeyID, message);
			this.sendUno(envelope.toBytes());
		});
	}

	/**
	 * Retreive a challenge from the lock.
	 */
	private getChallenge(): Promise<Uint8Array> {
		return new Promise(async (resolve, reject) => {
			const message = new ChallengeRequest(
				new ProtocolV2(this.sequenceNumber + 1)
			);
			const envelope = new Envelope(100, message);
			const subscription = this.device.monitorCharacteristicForService(
				Services.UnoPrimary,
				Characteristics.UnoTx,
				async (err, char) => {
					if (err || !char?.value) {
						console.error(err);
						return;
					}

					const response = await this.parseData(char.value);
					if (response && response.header.protocol instanceof ProtocolV2) {
						this.handleProtocol(response.header.protocol);
						resolve(response.header.protocol.challenge);
					} else {
						reject();
					}
					subscription.remove();
				}
			);

			this.sendUno(
				await envelope.toEncryptedBytes(keyPair.privateKey, this.publicKey!)
			);
		});
	}

	private handleMessage(message: IMessage) {
		this.handleProtocol(message.header.protocol);

		if (message instanceof BasicInfoResponse) {
		} else if (message instanceof CommandResponse) {
			if (message.status !== CommandResponseStatus.Success) {
				console.warn(`Command status ${CommandResponseStatus[message.status]}`);
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
