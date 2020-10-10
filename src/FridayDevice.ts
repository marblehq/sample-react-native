import {
  Advertisement,
  Characteristics,
  MessageFactory,
  Services,
} from '@fridayhome/messages';
import {decode, encode} from 'base-64';
import {Device} from 'react-native-ble-plx';
import {base64ToBytes} from './utils';

export class FridayDevice {
  device: Device;
  friday: Advertisement;

  constructor(device: Device, advertisement: Advertisement) {
    this.device = device;
    this.friday = advertisement;
  }

  public sendUno(bytes: number[]) {
    console.debug(`Sending to ${this.friday.manufacturerId}: ${bytes}`);
    const str = bytes.map((x) => String.fromCharCode(x)).join('');
    const value = encode(str);

    this.device
      .writeCharacteristicWithoutResponseForService(
        Services.UnoPrimary,
        Characteristics.UnoRx,
        value,
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
        const bytes = base64ToBytes(char.value);
        try {
          const message = MessageFactory.parse(bytes.slice(4));
          console.debug(message);
        } catch (ex) {
          console.debug(bytes);
          console.warn(ex);
        }
      },
    );
  }

  public printAllServicesAndCharacteristics() {
    this.device.services().then((ss) =>
      ss.forEach((s) => {
        s.characteristics().then((cs) => {
          console.debug(`Service: ${s.uuid}`);
          cs.forEach((c) => {
            console.debug(
              `Characteristic ${c.uuid} IsNotifiable: ${c.isNotifiable}`,
            );
          });
        });
      }),
    );
  }
}
