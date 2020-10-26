import sodium from 'react-native-sodium';
import { IEncryptor, NONCE_BYTES } from '@fridayhome/sdk';
import Base64 from 'base64-js';

export const Encryptor: IEncryptor = {
	encrypt: (
		message: Uint8Array,
		nonce: Uint8Array,
		publicKey: Uint8Array,
		privateKey: Uint8Array
	): Promise<Uint8Array> =>
		sodium
			.crypto_box_easy(
				Base64.fromByteArray(message),
				Base64.fromByteArray(nonce),
				Base64.fromByteArray(publicKey),
				Base64.fromByteArray(privateKey)
			)
			.then(Base64.toByteArray),
	decrypt: (
		message: Uint8Array,
		nonce: Uint8Array,
		privateKey: Uint8Array,
		publicKey: Uint8Array
	): Promise<Uint8Array> =>
		sodium
			.crypto_box_open_easy(
				Base64.fromByteArray(message),
				Base64.fromByteArray(nonce),
				Base64.fromByteArray(publicKey),
				Base64.fromByteArray(privateKey)
			)
			.then(Base64.toByteArray),
	generateNonce: () =>
		sodium.randombytes_buf(NONCE_BYTES).then(Base64.toByteArray),
};
