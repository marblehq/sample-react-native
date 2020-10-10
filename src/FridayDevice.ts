import {Advertisement, Characteristics, Services} from '@fridayhome/messages';
import {encode} from 'base-64';
import {Device} from 'react-native-ble-plx';

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
      .then((_) => console.debug('data sent'))
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

        console.log(char?.value);
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
