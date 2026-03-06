

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const escpos = require('escpos');

let BluetoothAdapter;
try {
  BluetoothAdapter = require('escpos-bluetooth');
  escpos.Bluetooth = BluetoothAdapter;
} catch (error) {
  console.warn('[printService] escpos-bluetooth not available:', error.message);
}

let bluetoothSerialPort;
try {
  bluetoothSerialPort = require('bluetooth-serial-port');
} catch (error) {
  console.warn('[printService] bluetooth-serial-port fallback not available:', error.message);
}

const DEFAULT_BT_ADDRESS = process.env.PRINTER_BT_ADDRESS || '00:00:00:00:00:00';
const DEFAULT_BT_CHANNEL = Number(process.env.PRINTER_BT_CHANNEL || 1);
const MAX_LINE_CHARS = Number(process.env.PRINTER_LINE_CHARS || 32); // 58 mm 


const normalizeLines = rawLines => {
  const expandedLines = [];
  rawLines.forEach(line => {
    const text = String(line || '');
    if (text.length <= MAX_LINE_CHARS) {
      expandedLines.push(text);
      return;
    }
    for (let i = 0; i < text.length; i += MAX_LINE_CHARS) {
      expandedLines.push(text.slice(i, i + MAX_LINE_CHARS));
    }
  });
  return expandedLines;
};


const printViaEscpos = (lines, { address, channel }) =>
  new Promise((resolve, reject) => {
    if (!BluetoothAdapter) {
      return reject(new Error('escpos-bluetooth adapter missing'));
    }

    const device = new escpos.Bluetooth(address, channel);
    const printer = new escpos.Printer(device, { encoding: 'GB18030' });

    device.open(error => {
      if (error) {
        return reject(error);
      }

      try {
        lines.forEach(line => printer.text(line));
        printer.cut().close();
        resolve();
      } catch (printError) {
        reject(printError);
      }
    });
  });


const printViaBluetoothSerial = (lines, { address, channel }) =>
  new Promise((resolve, reject) => {
    if (!bluetoothSerialPort) {
      return reject(new Error('bluetooth-serial-port module missing'));
    }

    const btSerial = new bluetoothSerialPort.BluetoothSerialPort();
    const payload = Buffer.from(`${lines.join('\n')}\n\n`, 'ascii');

    const connect = targetChannel => {
      btSerial.connect(
        address,
        targetChannel,
        () => {
          btSerial.write(payload, err => {
            if (err) {
              return reject(err);
            }
            btSerial.close();
            resolve();
          });
        },
        err => reject(err)
      );
    };

    if (channel) {
      connect(channel);
      return;
    }

    btSerial.findSerialPortChannel(
      address,
      discoveredChannel => connect(discoveredChannel),
      err => reject(err || new Error('Unable to locate printer channel'))
    );
  });

async function handlePrint(lines, config) {
  try {
    await printViaEscpos(lines, config);
  } catch (error) {
    console.warn('[printService] escpos-bluetooth failed, trying fallback:', error.message);
    await printViaBluetoothSerial(lines, config);
  }
}

function startPrintServer({
  port = 3000,
  printerAddress = DEFAULT_BT_ADDRESS,
  printerChannel = DEFAULT_BT_CHANNEL
} = {}) {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '10kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/print', async (req, res) => {
    const { lines } = req.body || {};
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ message: '`lines` array is required' });
    }

    try {
      await handlePrint(
        normalizeLines(lines),
        { address: printerAddress, channel: printerChannel }
      );
      res.json({ ok: true });
    } catch (error) {
      console.error('[printService] Failed to print:', error);
      res.status(500).json({ message: error.message });
    }
  });

  return new Promise((resolve, reject) => {
    const server = app
      .listen(port, () => {
        console.log(`[printService] Listening on http://localhost:${port}`);
        resolve(server);
      })
      .on('error', reject);
  });
}

module.exports = {
  startPrintServer
};

