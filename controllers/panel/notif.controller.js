import moment from "moment-timezone";
import defineUserDataModel from "../../models/pressure.model.js";
import { Op } from "sequelize";

export const getOffDevice = async (req, res) => {
  try {
    const { field_id } = req.body;

    const tableName = `pressure_${field_id}`;
    const Pressure = defineUserDataModel(tableName);

    const startOfDay = moment().startOf('day').toDate();
    const endOfDay = moment().endOf('day').toDate();

    const allData = await Pressure.findAll({
      where: {
        timestamp: {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        }
      },
      attributes: ['spot_id', 'timestamp'],
      order: [['spot_id', 'ASC'], ['timestamp', 'ASC']]
    });

    if (allData.length === 0) {
      return res.status(404).json({ message: 'No data found for this field' });
    }

    const now = moment();
    const gapThreshold = 5 * 60 * 1000; // 5 minutes in ms
    const spotStatus = new Map();

    for (const { spot_id, timestamp } of allData) {
      const ts = moment(timestamp);

      if (!spotStatus.has(spot_id)) {
        spotStatus.set(spot_id, {
          lastTimestamp: ts,
          downtimes: []
        });
        continue;
      }

      const status = spotStatus.get(spot_id);
      const diff = ts.diff(status.lastTimestamp);

      if (diff > gapThreshold) {
        status.downtimes.push({
          from: status.lastTimestamp.format('YYYY-MM-DD HH:mm:ss'),
          to: ts.format('YYYY-MM-DD HH:mm:ss'),
          durationMinutes: Math.round(diff / 60000)
        });
      }

      status.lastTimestamp = ts;
      spotStatus.set(spot_id, status);
    }

    const offDevices = [];

    for (const [spot_id, status] of spotStatus.entries()) {
      const lastTs = moment(status.lastTimestamp);
      const diffNow = now.diff(lastTs);
      const isCurrentlyOff = diffNow > gapThreshold;
      const hadDowntime = status.downtimes.length > 0;

      const deviceInfo = {
        spot_id,
        lastSeen: lastTs.format('YYYY-MM-DD HH:mm:ss'),
        isCurrentlyOff,
        hadDowntime,
        downtimes: [...status.downtimes]
      };

      // Tambahkan downtime terakhir yang sedang berlangsung (lastSeen → now)
      if (isCurrentlyOff) {
        deviceInfo.downtimes.push({
          from: lastTs.format('YYYY-MM-DD HH:mm:ss'),
          to: now.format('YYYY-MM-DD HH:mm:ss'),
          durationMinutes: Math.round(diffNow / 60000)
        });
      }

      if (deviceInfo.downtimes.length > 0) {
        offDevices.push(deviceInfo);
      }
    }

    // Normalisasi durasi
    const result = offDevices.map(device => ({
      ...device,
      downtimes: device.downtimes.map(dt => ({
        ...dt,
        durationMinutes: Number(dt.durationMinutes)
      }))
    }));

    res.json({ offDevices: result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
